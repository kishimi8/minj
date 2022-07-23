/*
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 *  The contents of this file are subject to the Mozilla Public License Version
 *  1.1 (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *  http://www.mozilla.org/MPL/
 *
 *  Software distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 *  for the specific language governing rights and limitations under the
 *  License.
 *
 *  The Original Code is part of dcm4che, an implementation of DICOM(TM) in
 *  Java(TM), hosted at https://github.com/dcm4che.
 *
 *  The Initial Developer of the Original Code is
 *  J4Care.
 *  Portions created by the Initial Developer are Copyright (C) 2015-2019
 *  the Initial Developer. All Rights Reserved.
 *
 *  Contributor(s):
 *  See @authors listed below
 *
 *  Alternatively, the contents of this file may be used under the terms of
 *  either the GNU General Public License Version 2 or later (the "GPL"), or
 *  the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 *  in which case the provisions of the GPL or the LGPL are applicable instead
 *  of those above. If you wish to allow use of your version of this file only
 *  under the terms of either the GPL or the LGPL, and not to allow others to
 *  use your version of this file under the terms of the MPL, indicate your
 *  decision by deleting the provisions above and replace them with the notice
 *  and other provisions required by the GPL or the LGPL. If you do not delete
 *  the provisions above, a recipient may use your version of this file under
 *  the terms of any one of the MPL, the GPL or the LGPL.
 *
 */

package org.dcm4chee.arc.dimse.rs;

import org.dcm4che3.conf.api.ConfigurationException;
import org.dcm4che3.conf.api.IApplicationEntityCache;
import org.dcm4che3.conf.api.IDeviceCache;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.data.VR;
import org.dcm4che3.net.*;
import org.dcm4che3.net.service.QueryRetrieveLevel2;
import org.dcm4che3.util.TagUtils;
import org.dcm4che3.util.UIDUtils;
import org.dcm4chee.arc.conf.ArchiveDeviceExtension;
import org.dcm4chee.arc.conf.Duration;
import org.dcm4chee.arc.keycloak.HttpServletRequestInfo;
import org.dcm4chee.arc.qmgt.TaskManager;
import org.dcm4chee.arc.query.scu.CFindSCU;
import org.dcm4chee.arc.query.util.QueryAttributes;
import org.dcm4chee.arc.retrieve.ExternalRetrieveContext;
import org.dcm4chee.arc.retrieve.mgt.RetrieveManager;
import org.dcm4chee.arc.validation.ParseDateTime;
import org.dcm4chee.arc.validation.constraints.InvokeValidate;
import org.dcm4chee.arc.validation.constraints.ValidValueOf;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.csv.CSVFormat;

import javax.enterprise.context.RequestScoped;
import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.Pattern;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import java.io.*;
import java.util.ArrayList;
import java.util.Date;
import java.util.EnumSet;
import java.util.List;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Jul 2017
 */
@RequestScoped
@Path("aets/{AETitle}/dimse/{movescp}")
@InvokeValidate(type = QueryRetrieveRS.class)
public class QueryRetrieveRS {

    private static final Logger LOG = LoggerFactory.getLogger(QueryRetrieveRS.class);

    @Context
    private HttpServletRequest request;

    @Context
    private UriInfo uriInfo;

    @Inject
    private Device device;

    @Inject
    private IDeviceCache deviceCache;

    @PathParam("AETitle")
    private String aet;

    @PathParam("movescp")
    private String movescp;

    @QueryParam("batchID")
    private String batchID;

    @QueryParam("dicomDeviceName")
    private String deviceName;

    @QueryParam("scheduledTime")
    @ValidValueOf(type = ParseDateTime.class)
    private String scheduledTime;

    @QueryParam("dcmQueueName")
    @DefaultValue("Retrieve")
    private String queueName;

    @QueryParam("fuzzymatching")
    @Pattern(regexp = "true|false")
    private String fuzzymatching;

    @QueryParam("priority")
    @Pattern(regexp = "0|1|2")
    private String priority;

    @QueryParam("SplitStudyDateRange")
    @ValidValueOf(type = Duration.class)
    private String splitStudyDateRange;

    @Inject
    private CFindSCU findSCU;

    @Inject
    private RetrieveManager retrieveManager;

    @Inject
    private TaskManager taskManager;

    @Inject
    private IApplicationEntityCache aeCache;

    @HeaderParam("Content-Type")
    private MediaType contentType;

    @Override
    public String toString() {
        String requestURI = request.getRequestURI();
        String queryString = request.getQueryString();
        return queryString == null ? requestURI : requestURI + '?' + queryString;
    }

    public void validate() {
        logRequest();
        new QueryAttributes(uriInfo, null);
    }

    @POST
    @Path("/query:{QueryAET}/studies/export/dicom:{DestinationAET}")
    @Produces("application/json")
    public Response queryRetrieveMatchingStudies(
            @PathParam("QueryAET") String queryAET,
            @PathParam("DestinationAET") String destAET) {
        return process(QueryRetrieveLevel2.STUDY, null, null, queryAET, destAET);
    }

    @POST
    @Path("/query:{QueryAET}/studies/{StudyInstanceUID}/series/export/dicom:{DestinationAET}")
    @Produces("application/json")
    public Response queryRetrieveMatchingSeries(
            @PathParam("StudyInstanceUID") String studyInstanceUID,
            @PathParam("QueryAET") String queryAET,
            @PathParam("DestinationAET") String destAET){
        return process(QueryRetrieveLevel2.SERIES, studyInstanceUID, null, queryAET, destAET);
    }

    @POST
    @Path("/query:{QueryAET}/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/export/dicom:{DestinationAET}")
    @Produces("application/json")
    public Response queryRetrieveMatchingInstances(
            @PathParam("StudyInstanceUID") String studyInstanceUID,
            @PathParam("SeriesInstanceUID") String seriesInstanceUID,
            @PathParam("QueryAET") String queryAET,
            @PathParam("DestinationAET") String destAET) {
        return process(QueryRetrieveLevel2.IMAGE, studyInstanceUID, seriesInstanceUID, queryAET, destAET);
    }

    @POST
    @Path("/studies/export/dicom:{DestinationAET}")
    @Produces("application/json")
    public Response retrieveMatchingStudies(
            @PathParam("DestinationAET") String destAET) {
        return process(QueryRetrieveLevel2.STUDY, null, null, destAET);
    }

    @POST
    @Path("/studies/{StudyInstanceUID}/series/export/dicom:{DestinationAET}")
    @Produces("application/json")
    public Response retrieveMatchingSeries(
            @PathParam("StudyInstanceUID") String studyInstanceUID,
            @PathParam("DestinationAET") String destAET) {
        return process(QueryRetrieveLevel2.SERIES, studyInstanceUID, null, destAET);
    }

    @POST
    @Path("/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/export/dicom:{DestinationAET}")
    @Produces("application/json")
    public Response retrieveMatchingInstances(
            @PathParam("StudyInstanceUID") String studyInstanceUID,
            @PathParam("SeriesInstanceUID") String seriesInstanceUID,
            @PathParam("DestinationAET") String destAET) {
        return process(QueryRetrieveLevel2.IMAGE, studyInstanceUID, seriesInstanceUID, destAET);
    }

    @POST
    @Path("/studies/csv:{field}/export/dicom:{destinationAET}")
    @Consumes("text/csv")
    @Produces("application/json")
    public Response retrieveMatchingStudiesFromCSV(
            @PathParam("field") int field,
            @PathParam("destinationAET") String destAET,
            InputStream in) {
        return processCSV(field, destAET, in);
    }

    private Response processCSV(int field, String destAET, InputStream in) {
        try {
            validate(null);
            Response.Status status = Response.Status.BAD_REQUEST;
            if (field < 1)
                return errResponse(
                        "CSV field for Study Instance UID should be greater than or equal to 1", status);

            priorityAsInt = parseInt(priority, 0);
            int count = 0;
            String warning = null;
            ArchiveDeviceExtension arcDev = device.getDeviceExtensionNotNull(ArchiveDeviceExtension.class);
            int csvUploadChunkSize = arcDev.getCSVUploadChunkSize();
            List<String> studyUIDs = new ArrayList<>();

            try (
                    BufferedReader reader = new BufferedReader(new InputStreamReader(in));
                    CSVParser parser = new CSVParser(reader, CSVFormat.DEFAULT.builder()
                                                                                .setDelimiter(csvDelimiter())
                                                                                .build())
            ) {
                boolean header = true;
                for (CSVRecord csvRecord : parser) {
                    if (csvRecord.size() == 0 || csvRecord.get(0).isEmpty())
                        continue;

                    String studyUID = csvRecord.get(field - 1).replaceAll("\"", "");
                    if (header && studyUID.chars().allMatch(Character::isLetter)) {
                        header = false;
                        continue;
                    }

                    if (!arcDev.isValidateUID() || validateUID(studyUID))
                        studyUIDs.add(studyUID);

                    if (studyUIDs.size() == csvUploadChunkSize) {
                        count += scheduleRetrieveTask(createExtRetrieveCtx(destAET, studyUIDs.toArray(new String[0])));
                        studyUIDs.clear();
                    }
                }
                if (!studyUIDs.isEmpty())
                    count += scheduleRetrieveTask(createExtRetrieveCtx(destAET, studyUIDs.toArray(new String[0])));

                if (count == 0) {
                    warning = "Empty file or Incorrect field position or Not a CSV file or Invalid UIDs or Duplicate Retrieves suppressed.";
                    status = Response.Status.NO_CONTENT;
                }
            } catch (Exception e) {
                warning = e.getMessage();
                status = Response.Status.INTERNAL_SERVER_ERROR;
            }
            if (count > 0 && scheduledOnThisDevice() && scheduledTime == null) {
                taskManager.processQueue(queueName);
            }
            if (warning == null && count > 0)
                return Response.accepted(count(count)).build();

            LOG.warn("Response {} caused by {}", status, warning);
            Response.ResponseBuilder builder = Response.status(status)
                    .header("Warning", warning);
            if (count > 0)
                builder.entity(count(count));

            return builder.build();
        } catch (IllegalStateException | IllegalArgumentException | ConfigurationException e) {
            return errResponse(e.getMessage(), Response.Status.NOT_FOUND);
        } catch (Exception e) {
            return errResponseAsTextPlain(exceptionAsString(e), Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    private boolean validateUID(String studyUID) {
        boolean valid = UIDUtils.isValid(studyUID);
        if (!valid)
            LOG.warn("Invalid UID in CSV file: " + studyUID);
        return valid;
    }

    private Response errResponse(String msg, Response.Status status) {
        return errResponseAsTextPlain("{\"errorMessage\":\"" + msg + "\"}", status);
    }

    private Response errResponseAsTextPlain(String errorMsg, Response.Status status) {
        LOG.warn("Response {} caused by {}", status, errorMsg);
        return Response.status(status)
                .entity(errorMsg)
                .type("text/plain")
                .build();
    }

    private String exceptionAsString(Exception e) {
        StringWriter sw = new StringWriter();
        e.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }

    private int priorityAsInt;

    private static int parseInt(String s, int defval) {
        return s != null ? Integer.parseInt(s) : defval;
    }

    private char csvDelimiter() {
        return ("semicolon".equals(contentType.getParameters().get("delimiter"))) ? ';' : ',';
    }

    private Duration splitStudyDateRange() {
        return splitStudyDateRange != null ? Duration.valueOf(splitStudyDateRange) : null;
    }

    private Response process(QueryRetrieveLevel2 level, String studyInstanceUID, String seriesInstanceUID,
                             String destAET) {
        return process(level, studyInstanceUID, seriesInstanceUID, movescp, destAET);
    }
    
    private Response process(QueryRetrieveLevel2 level, String studyInstanceUID, String seriesInstanceUID,
                             String queryAET, String destAET) {
        ApplicationEntity localAE = device.getApplicationEntity(aet, true);
        if (localAE == null || !localAE.isInstalled())
            return errResponse("No such Application Entity: " + aet, Response.Status.NOT_FOUND);

        try {
            validate(queryAET);
            QueryAttributes queryAttributes = new QueryAttributes(uriInfo, null);
            queryAttributes.addReturnTags(level.uniqueKey());
            Attributes keys = queryAttributes.getQueryKeys();
            keys.setString(Tag.QueryRetrieveLevel, VR.CS, level.name());
            if (studyInstanceUID != null)
                keys.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUID);
            if (seriesInstanceUID != null)
                keys.setString(Tag.SeriesInstanceUID, VR.UI, seriesInstanceUID);
            if (level == QueryRetrieveLevel2.IMAGE && !keys.contains(Tag.SOPInstanceUID))
                keys.setNull(Tag.SOPInstanceUID, VR.UI);
            EnumSet<QueryOption> queryOptions = EnumSet.of(QueryOption.DATETIME);
            if (Boolean.parseBoolean(fuzzymatching))
                queryOptions.add(QueryOption.FUZZY);
            Association as = null;
            String warning;
            int count = 0;
            Response.Status errorStatus = Response.Status.BAD_GATEWAY;
            try {
                as = findSCU.openAssociation(localAE, queryAET, UID.StudyRootQueryRetrieveInformationModelFind, queryOptions);
                priorityAsInt = parseInt(priority, 0);
                DimseRSP dimseRSP = findSCU.query(as, priorityAsInt,
                        findSCU.coerceCFindRQ(as, keys),
                        0, 1, splitStudyDateRange());
                dimseRSP.next();
                int status;
                do {
                    status = dimseRSP.getCommand().getInt(Tag.Status, -1);
                    if (Status.isPending(status))
                        count += scheduleRetrieveTask(createExtRetrieveCtx(destAET, queryAET, dimseRSP));
                } while (dimseRSP.next());
                warning = warning(status);
            } catch (IllegalStateException | IllegalArgumentException | ConfigurationException e) {
                errorStatus = Response.Status.NOT_FOUND;
                warning = e.getMessage();
            } catch (Exception e) {
                warning = e.getMessage();
            } finally {
                if (as != null)
                    try {
                        as.release();
                    } catch (IOException e) {
                        LOG.info("{}: Failed to release association:\\n", as, e);
                    }
            }
            if (count > 0 && scheduledOnThisDevice() && scheduledTime == null) {
                taskManager.processQueue(queueName);
            }
            if (warning == null)
                return Response.accepted(count(count)).build();

            LOG.warn("Response {} caused by {}", errorStatus, warning);
            Response.ResponseBuilder builder = Response.status(errorStatus)
                    .header("Warning", warning);
            if (count > 0)
                builder.entity(count(count));
            return builder.build();
        } catch (IllegalStateException | IllegalArgumentException | ConfigurationException e) {
            return errResponse(e.getMessage(), Response.Status.NOT_FOUND);
        } catch (Exception e) {
            return errResponseAsTextPlain(exceptionAsString(e), Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    private boolean scheduledOnThisDevice() {
        return deviceName == null || deviceName.equals(device.getDeviceName());
    }

    private void validate(String queryAET) throws ConfigurationException {
        if (queryAET != null && !queryAET.equals(movescp))
            aeCache.findApplicationEntity(queryAET);

        aeCache.findApplicationEntity(movescp);
        if (!scheduledOnThisDevice()) {
            Device device = deviceCache.findDevice(deviceName);
            ApplicationEntity ae = device.getApplicationEntity(aet, true);
            if (ae == null || !ae.isInstalled())
                throw new ConfigurationException("No such Application Entity: " + aet + " found in device: " + deviceName);

            validateQueue(device);
        } else
            validateQueue(device);
    }

    private void validateQueue(Device device) {
        device.getDeviceExtensionNotNull(ArchiveDeviceExtension.class).getQueueDescriptorNotNull(queueName);
    }

    private int scheduleRetrieveTask(ExternalRetrieveContext ctx) {
        return retrieveManager.scheduleRetrieveTask(ctx, null);
    }

    private void logRequest() {
        LOG.info("Process {} {} from {}@{}",
                request.getMethod(),
                toString(),
                request.getRemoteUser(),
                request.getRemoteHost());
    }

    private ExternalRetrieveContext createExtRetrieveCtx(String destAET, String queryAET, DimseRSP dimseRSP) {
        Attributes keys = new Attributes(dimseRSP.getDataset(),
                Tag.SOPInstanceUID, Tag.QueryRetrieveLevel, Tag.StudyInstanceUID, Tag.SeriesInstanceUID);
        return createExtRetrieveCtx(destAET, queryAET, keys);
    }

    private ExternalRetrieveContext createExtRetrieveCtx(String destAET, String... studyIUID) {
        Attributes keys = new Attributes(2);
        keys.setString(Tag.QueryRetrieveLevel, VR.CS, QueryRetrieveLevel2.STUDY.name());
        keys.setString(Tag.StudyInstanceUID, VR.UI, studyIUID);
        return createExtRetrieveCtx(destAET, null, keys);
    }

    private ExternalRetrieveContext createExtRetrieveCtx(String destAET, String queryAET, Attributes keys) {
        return new ExternalRetrieveContext()
                .setDeviceName(deviceName != null ? deviceName : device.getDeviceName())
                .setQueueName(queueName)
                .setBatchID(batchID)
                .setLocalAET(aet)
                .setRemoteAET(movescp)
                .setFindSCP(queryAET)
                .setDestinationAET(destAET)
                .setHttpServletRequestInfo(HttpServletRequestInfo.valueOf(request))
                .setScheduledTime(scheduledTime != null ? ParseDateTime.valueOf(scheduledTime) : new Date())
                .setKeys(keys);
    }

    private static String count(int count) {
        return "{\"count\":" + count + '}';
    }

    private static String warning(int status) {
        switch (status) {
            case Status.Success:
                return null;
            case Status.OutOfResources:
                return "A700: Refused: Out of Resources";
            case Status.IdentifierDoesNotMatchSOPClass:
                return "A900: Identifier does not match SOP Class";
        }
        return TagUtils.shortToHexString(status)
                + ((status & Status.UnableToProcess) == Status.UnableToProcess
                ? ": Unable to Process"
                : ": Unexpected status code");
    }
}
