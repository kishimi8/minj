/*
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is part of dcm4che, an implementation of DICOM(TM) in
 * Java(TM), hosted at https://github.com/gunterze/dcm4che.
 *
 * The Initial Developer of the Original Code is
 * J4Care.
 * Portions created by the Initial Developer are Copyright (C) 2015-2019
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * See @authors listed below
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 */

package org.dcm4chee.arc.export.rs;

import org.dcm4che3.data.*;
import org.dcm4che3.net.ApplicationEntity;
import org.dcm4che3.net.Device;
import org.dcm4che3.net.service.QueryRetrieveLevel2;
import org.dcm4chee.arc.conf.ArchiveDeviceExtension;
import org.dcm4chee.arc.conf.ExporterDescriptor;
import org.dcm4chee.arc.entity.ExpirationState;
import org.dcm4chee.arc.entity.Patient;
import org.dcm4chee.arc.export.mgt.ExportManager;
import org.dcm4chee.arc.keycloak.HttpServletRequestInfo;
import org.dcm4chee.arc.qmgt.impl.TaskScheduler;
import org.dcm4chee.arc.query.Query;
import org.dcm4chee.arc.query.QueryContext;
import org.dcm4chee.arc.query.QueryService;
import org.dcm4chee.arc.query.RunInTransaction;
import org.dcm4chee.arc.query.util.QueryAttributes;
import org.dcm4chee.arc.validation.ParseDateTime;
import org.dcm4chee.arc.validation.constraints.InvokeValidate;
import org.dcm4chee.arc.validation.constraints.ValidValueOf;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.enterprise.context.RequestScoped;
import javax.inject.Inject;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.Pattern;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Dec 2017
 */
@RequestScoped
@Path("aets/{AETitle}/rs")
@InvokeValidate(type = ExportMatchingRS.class)
public class ExportMatchingRS {

    private static final Logger LOG = LoggerFactory.getLogger(ExportMatchingRS.class);

    @PathParam("AETitle")
    private String aet;

    @Context
    private HttpServletRequest request;

    @Context
    private UriInfo uriInfo;

    @Inject
    private Device device;

    @Inject
    private QueryService queryService;

    @Inject
    private ExportManager exportManager;

    @Inject
    private TaskScheduler taskScheduler;

    @Inject
    private RunInTransaction runInTx;

    @QueryParam("fuzzymatching")
    @Pattern(regexp = "true|false")

    private String fuzzymatching;
    @QueryParam("incomplete")
    @Pattern(regexp = "true|false")

    private String incomplete;
    @QueryParam("retrievefailed")
    @Pattern(regexp = "true|false")

    private String retrievefailed;
    @QueryParam("storageVerificationFailed")
    @Pattern(regexp = "true|false")

    private String storageVerificationFailed;
    @QueryParam("metadataUpdateFailed")
    @Pattern(regexp = "true|false")

    private String metadataUpdateFailed;
    @QueryParam("compressionfailed")
    @Pattern(regexp = "true|false")

    private String compressionfailed;
    @QueryParam("ExpirationDate")

    private String expirationDate;
    @QueryParam("ExternalRetrieveAET")

    private String externalRetrieveAET;

    @QueryParam("ExternalRetrieveAET!")
    private String externalRetrieveAETNot;

    @QueryParam("patientVerificationStatus")
    @Pattern(regexp = "UNVERIFIED|VERIFIED|NOT_FOUND|VERIFICATION_FAILED")
    private String patientVerificationStatus;

    @QueryParam("batchID")
    private String batchID;

    @QueryParam("storageID")
    private String storageID;

    @QueryParam("storageClustered")
    @Pattern(regexp = "true|false")
    private String storageClustered;

    @QueryParam("storageExported")
    @Pattern(regexp = "true|false")
    private String storageExported;

    @QueryParam("allOfModalitiesInStudy")
    @Pattern(regexp = "true|false")
    private String allOfModalitiesInStudy;

    @QueryParam("StudySizeInKB")
    @Pattern(regexp = "\\d{1,9}(-\\d{0,9})?|-\\d{1,9}")
    private String studySizeInKB;

    @QueryParam("ExpirationState")
    @Pattern(regexp = "UPDATEABLE|FROZEN|REJECTED|EXPORT_SCHEDULED|FAILED_TO_EXPORT|FAILED_TO_REJECT")
    private String expirationState;

    @QueryParam("scheduledTime")
    @ValidValueOf(type = ParseDateTime.class)
    private String scheduledTime;

    @POST
    @Path("/studies/export/{ExporterID}")
    @Produces("application/json")
    public Response exportMatchingStudies(@PathParam("ExporterID") String exporterID) {
        return exportMatching(exporterID, aet,
                "exportMatchingStudies",
                QueryRetrieveLevel2.STUDY,
                null,
                null);
    }

    @POST
    @Path("/series/export/{ExporterID}")
    @Produces("application/json")
    public Response exportMatchingSeries(@PathParam("ExporterID") String exporterID) {
        return exportMatching(exporterID, aet,
                "exportMatchingSeries",
                QueryRetrieveLevel2.SERIES,
                null,
                null);
    }

    @POST
    @Path("/studies/{StudyInstanceUID}/series/export/{ExporterID}")
    @Produces("application/json")
    public Response exportMatchingSeriesOfStudy(
            @PathParam("ExporterID") String exporterID,
            @PathParam("StudyInstanceUID") String studyInstanceUID) {
        return exportMatching(exporterID, aet,
                "exportMatchingSeriesOfStudy",
                QueryRetrieveLevel2.SERIES,
                studyInstanceUID,
                null);
    }

    @POST
    @Path("/instances/export/{ExporterID}")
    @Produces("application/json")
    public Response exportMatchingInstances(@PathParam("ExporterID") String exporterID) {
        return exportMatching(exporterID, aet,
                "exportMatchingInstances",
                QueryRetrieveLevel2.IMAGE,
                null,
                null);
    }

    @POST
    @Path("/studies/{StudyInstanceUID}/instances/export/{ExporterID}")
    @Produces("application/json")
    public Response exportMatchingInstancesOfStudy(
            @PathParam("ExporterID") String exporterID,
            @PathParam("StudyInstanceUID") String studyInstanceUID) {
        return exportMatching(exporterID, aet,
                "exportMatchingInstancesOfStudy",
                QueryRetrieveLevel2.IMAGE, studyInstanceUID,
                null);
    }

    @POST
    @Path("/studies/{StudyInstanceUID}/series/{SeriesInstanceUID}/instances/export/{ExporterID}")
    @Produces("application/json")
    public Response exportMatchingInstancesOfSeries(
            @PathParam("ExporterID") String exporterID,
            @PathParam("StudyInstanceUID") String studyInstanceUID,
            @PathParam("SeriesInstanceUID") String seriesInstanceUID) {
        return exportMatching(exporterID, aet,
                "exportMatchingInstancesOfSeries",
                QueryRetrieveLevel2.IMAGE,
                studyInstanceUID,
                seriesInstanceUID);
    }

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

    private Response exportMatching(String exporterID, String aet,
                            String method, QueryRetrieveLevel2 qrlevel, String studyInstanceUID, String seriesInstanceUID) {
        ApplicationEntity ae = device.getApplicationEntity(aet, true);
        if (ae == null || !ae.isInstalled())
            return errResponse(Response.Status.NOT_FOUND, "No such Application Entity: " + aet);

        try {
            ArchiveDeviceExtension arcDev = device.getDeviceExtensionNotNull(ArchiveDeviceExtension.class);
            ExporterDescriptor exporter = arcDev.getExporterDescriptor(exporterID);
            if (exporter == null)
                return errResponse(Response.Status.NOT_FOUND, "No such Exporter: " + exporterID);

            QueryContext ctx = queryContext(method, qrlevel, studyInstanceUID, seriesInstanceUID, ae);
            String warning;
            int count;
            Response.Status status = Response.Status.ACCEPTED;
            try (Query query = queryService.createQuery(ctx)) {
                int queryMaxNumberOfResults = ctx.getArchiveAEExtension().queryMaxNumberOfResults();
                if (queryMaxNumberOfResults > 0 && !ctx.containsUniqueKey()
                        && query.fetchCount() > queryMaxNumberOfResults)
                    return errResponse(Response.Status.BAD_REQUEST, "Request entity too large");

                ExportMatchingObjects exportMatchingObjects = new ExportMatchingObjects(
                        exporter, qrlevel, query, scheduledTime(), status);
                runInTx.execute(exportMatchingObjects);
                count = exportMatchingObjects.getCount();
                status = exportMatchingObjects.getStatus();
                warning = exportMatchingObjects.getWarning();
            }
            if (count > 0 && scheduledTime == null) {
                taskScheduler.process(
                        arcDev.getQueueDescriptorNotNull(exporter.getQueueName()),
                        arcDev.getTaskFetchSize());
            }
            Response.ResponseBuilder builder = Response.status(status);
            if (warning != null) {
                LOG.warn("Response {} caused by {}", status, warning);
                builder.header("Warning", warning);
            }
            return builder.entity("{\"count\":" + count + '}').build();
        } catch (IllegalStateException e) {
            return errResponse(Response.Status.NOT_FOUND, e.getMessage());
        } catch (Exception e) {
            return errResponseAsTextPlain(exceptionAsString(e), Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    private void logRequest() {
        LOG.info("Process {} {} from {}@{}",
                request.getMethod(),
                toString(),
                request.getRemoteUser(),
                request.getRemoteHost());
    }

    private Date scheduledTime() {
        if (scheduledTime != null)
            try {
                return new SimpleDateFormat("yyyyMMddhhmmss").parse(scheduledTime);
            } catch (Exception e) {
                LOG.info(e.getMessage());
            }

        return new Date();
    }

    private Response errResponse(Response.Status status, String msg) {
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

    private QueryContext queryContext(
            String method, QueryRetrieveLevel2 qrlevel, String studyInstanceUID, String seriesInstanceUID,
            ApplicationEntity ae) {
        QueryContext ctx = queryService.newQueryContextQIDO(
                HttpServletRequestInfo.valueOf(request), method, aet, ae, queryParam(ae));
        ctx.setQueryRetrieveLevel(qrlevel);
        QueryAttributes queryAttrs = new QueryAttributes(uriInfo, null);
        Attributes keys = queryAttrs.getQueryKeys();
        IDWithIssuer idWithIssuer = IDWithIssuer.pidOf(keys);
        if (idWithIssuer != null && !idWithIssuer.getID().equals("*"))
            ctx.setPatientIDs(idWithIssuer);
        else if (ctx.getArchiveAEExtension().filterByIssuerOfPatientID())
            ctx.setIssuerOfPatientID(Issuer.fromIssuerOfPatientID(keys));
        if (studyInstanceUID != null)
            keys.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUID);
        if (seriesInstanceUID != null)
            keys.setString(Tag.SeriesInstanceUID, VR.UI, seriesInstanceUID);
        ctx.setQueryKeys(keys);
        Attributes returnKeys = new Attributes(3);
        returnKeys.setNull(Tag.StudyInstanceUID, VR.UI);
        switch (qrlevel) {
            case IMAGE:
                returnKeys.setNull(Tag.SOPInstanceUID, VR.UI);
            case SERIES:
                returnKeys.setNull(Tag.SeriesInstanceUID, VR.UI);
        }
        ctx.setReturnKeys(returnKeys);
        return ctx;
    }

    private org.dcm4chee.arc.query.util.QueryParam queryParam(ApplicationEntity ae) {
        org.dcm4chee.arc.query.util.QueryParam queryParam = new org.dcm4chee.arc.query.util.QueryParam(ae);
        queryParam.setCombinedDatetimeMatching(true);
        queryParam.setFuzzySemanticMatching(Boolean.parseBoolean(fuzzymatching));
        queryParam.setAllOfModalitiesInStudy(Boolean.parseBoolean(allOfModalitiesInStudy));
        queryParam.setIncomplete(Boolean.parseBoolean(incomplete));
        queryParam.setRetrieveFailed(Boolean.parseBoolean(retrievefailed));
        queryParam.setStorageVerificationFailed(Boolean.parseBoolean(storageVerificationFailed));
        queryParam.setMetadataUpdateFailed(Boolean.parseBoolean(metadataUpdateFailed));
        queryParam.setCompressionFailed(Boolean.parseBoolean(compressionfailed));
        queryParam.setExternalRetrieveAET(externalRetrieveAET);
        queryParam.setExternalRetrieveAETNot(externalRetrieveAETNot);
        queryParam.setExpirationDate(expirationDate);
        if (patientVerificationStatus != null)
            queryParam.setPatientVerificationStatus(Patient.VerificationStatus.valueOf(patientVerificationStatus));
        if (storageID != null)
            queryParam.setStudyStorageIDs(device.getDeviceExtensionNotNull(ArchiveDeviceExtension.class)
                    .getStudyStorageIDs(storageID, parseBoolean(storageClustered), parseBoolean(storageExported)));
        queryParam.setStudySizeRange(studySizeInKB);
        if (expirationState != null)
            queryParam.setExpirationState(ExpirationState.valueOf(expirationState));
        return queryParam;
    }

    private static Boolean parseBoolean(String s) {
        return s != null ? Boolean.valueOf(s) : null;
    }

    class ExportMatchingObjects implements Runnable {
        private int count;
        private final ExporterDescriptor exporter;
        private final QueryRetrieveLevel2 qrLevel;
        private final Query query;
        private final Date scheduledTime;
        private Response.Status status;
        private String warning;

        ExportMatchingObjects(
                ExporterDescriptor exporter, QueryRetrieveLevel2 qrLevel, Query query, Date scheduledTime, Response.Status status) {
            this.exporter = exporter;
            this.qrLevel = qrLevel;
            this.query = query;
            this.scheduledTime = scheduledTime;
            this.status = status;
        }

        int getCount() {
            return count;
        }

        Response.Status getStatus() {
            return status;
        }

        String getWarning() {
            return warning;
        }

        @Override
        public void run() {
            try {
                query.executeQuery(device.getDeviceExtensionNotNull(ArchiveDeviceExtension.class).getQueryFetchSize());
                while (query.hasMoreMatches()) {
                    Attributes match = query.nextMatch();
                    if (match == null)
                        continue;

                    exportManager.createExportTask(
                            device.getDeviceName(),
                            exporter,
                            match.getString(Tag.StudyInstanceUID),
                            qrLevel != QueryRetrieveLevel2.STUDY ? match.getString(Tag.SeriesInstanceUID) : "*",
                            qrLevel == QueryRetrieveLevel2.IMAGE ? match.getString(Tag.SOPInstanceUID) : "*",
                            batchID,
                            scheduledTime,
                            HttpServletRequestInfo.valueOf(request));
                    count++;
                }
            } catch (Exception e) {
                warning = e.getMessage();
                status = Response.Status.INTERNAL_SERVER_ERROR;
            }
        }
    }
}
