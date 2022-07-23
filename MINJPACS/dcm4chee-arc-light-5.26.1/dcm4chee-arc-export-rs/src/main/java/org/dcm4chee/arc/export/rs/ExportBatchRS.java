/*
 * *** BEGIN LICENSE BLOCK *****
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
 * Java(TM), hosted at https://github.com/dcm4che.
 *
 * The Initial Developer of the Original Code is
 * J4Care.
 * Portions created by the Initial Developer are Copyright (C) 2017-2019
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
 * *** END LICENSE BLOCK *****
 */

package org.dcm4chee.arc.export.rs;

import org.dcm4che3.conf.json.JsonWriter;
import org.dcm4che3.util.StringUtils;
import org.dcm4chee.arc.entity.Task;
import org.dcm4chee.arc.export.mgt.ExportBatch;
import org.dcm4chee.arc.export.mgt.ExportManager;
import org.dcm4chee.arc.query.util.TaskQueryParam;
import org.jboss.resteasy.annotations.cache.NoCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.enterprise.context.RequestScoped;
import javax.inject.Inject;
import javax.json.Json;
import javax.json.stream.JsonGenerator;
import javax.servlet.http.HttpServletRequest;
import javax.validation.constraints.Pattern;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.StreamingOutput;
import javax.ws.rs.core.UriInfo;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Feb 2018
 */
@RequestScoped
@Path("monitor/export/batch")
public class ExportBatchRS {
    private static final Logger LOG = LoggerFactory.getLogger(ExportBatchRS.class);

    @Inject
    private ExportManager mgr;

    @Context
    private UriInfo uriInfo;

    @QueryParam("dicomDeviceName")
    private String deviceName;

    @QueryParam("status")
    @Pattern(regexp = "SCHEDULED|IN PROCESS|COMPLETED|WARNING|FAILED|CANCELED")
    private String status;

    @QueryParam("createdTime")
    private String createdTime;

    @QueryParam("updatedTime")
    private String updatedTime;

    @QueryParam("offset")
    @Pattern(regexp = "0|([1-9]\\d{0,4})")
    private String offset;

    @QueryParam("limit")
    @Pattern(regexp = "[1-9]\\d{0,4}")
    private String limit;

    @QueryParam("orderby")
    @DefaultValue("-updatedTime")
    @Pattern(regexp = "(-?)createdTime|(-?)updatedTime|(-?)scheduledTime")
    private String orderby;

    @QueryParam("batchID")
    private String batchID;

    @QueryParam("ExporterID")
    private List<String> exporterIDs;

    @Context
    private HttpServletRequest request;

    @Override
    public String toString() {
        String requestURI = request.getRequestURI();
        String queryString = request.getQueryString();
        return queryString == null ? requestURI : requestURI + '?' + queryString;
    }

    @GET
    @NoCache
    @Produces("application/json")
    public Response listExportBatches() {
        logRequest();
        try {
            List<ExportBatch> exportBatches = mgr.listExportBatches(
                    taskQueryParam(),
                    parseInt(offset),
                    parseInt(limit));
            return Response.ok(Output.JSON.entity(exportBatches)).build();
        } catch (Exception e) {
            return errResponseAsTextPlain(exceptionAsString(e), Response.Status.INTERNAL_SERVER_ERROR);
        }
    }

    private enum Output {
        JSON {
            @Override
            Object entity(final List<ExportBatch> exportBatches) {
                return (StreamingOutput) out -> {
                    JsonGenerator gen = Json.createGenerator(out);
                    gen.writeStartArray();
                    exportBatches.forEach(exportBatch -> {
                        JsonWriter writer = new JsonWriter(gen);
                        gen.writeStartObject();
                        writer.writeNotNullOrDef("batchID", exportBatch.getBatchID(), null);
                        writeTasks(exportBatch, writer);
                        writer.writeNotEmpty("dicomDeviceName", exportBatch.getDeviceNames());
                        writer.writeNotEmpty("ExporterID", exportBatch.getExporterIDs());
                        writer.writeNotEmpty("createdTimeRange", datesAsStrings(exportBatch.getCreatedTimeRange()));
                        writer.writeNotEmpty("updatedTimeRange", datesAsStrings(exportBatch.getUpdatedTimeRange()));
                        writer.writeNotEmpty("scheduledTimeRange", datesAsStrings(exportBatch.getScheduledTimeRange()));
                        writer.writeNotEmpty("processingStartTimeRange", datesAsStrings(exportBatch.getProcessingStartTimeRange()));
                        writer.writeNotEmpty("processingEndTimeRange", datesAsStrings(exportBatch.getProcessingEndTimeRange()));
                        gen.writeEnd();
                    });
                    gen.writeEnd();
                    gen.flush();
                };
            }

            private void writeTasks(ExportBatch exportBatch, JsonWriter writer) {
                writer.writeStartObject("tasks");
                writer.writeNotNullOrDef("scheduled", exportBatch.getScheduled(), 0);
                writer.writeNotNullOrDef("in-process", exportBatch.getInProcess(), 0);
                writer.writeNotNullOrDef("warning", exportBatch.getWarning(), 0);
                writer.writeNotNullOrDef("failed", exportBatch.getFailed(), 0);
                writer.writeNotNullOrDef("canceled", exportBatch.getCanceled(), 0);
                writer.writeNotNullOrDef("completed", exportBatch.getCompleted(), 0);
                writer.writeEnd();
            }

            private String[] datesAsStrings(Date[] dates) {
                String[] datesAsStrings = new String[dates.length];
                DateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
                for (int i = 0; i < dates.length; i++)
                    datesAsStrings[i] = df.format(dates[i]);
                return datesAsStrings;
            }
        };

        abstract Object entity(final List<ExportBatch> exportBatches);
    }

    private static int parseInt(String s) {
        return s != null ? Integer.parseInt(s) : 0;
    }

    private void logRequest() {
        LOG.info("Process {} {} from {}@{}",
                request.getMethod(),
                toString(),
                request.getRemoteUser(),
                request.getRemoteHost());
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

    private TaskQueryParam taskQueryParam() {
        TaskQueryParam taskQueryParam = new TaskQueryParam();
        taskQueryParam.setDeviceName(deviceName);
        taskQueryParam.setStatus(status);
        taskQueryParam.setBatchID(batchID);
        taskQueryParam.setCreatedTime(createdTime);
        taskQueryParam.setUpdatedTime(updatedTime);
        taskQueryParam.setOrderBy(orderby);
        taskQueryParam.setType(Task.Type.EXPORT);
        taskQueryParam.setExporterIDs(exporterIDs.stream()
                .flatMap(exporterID -> Stream.of(StringUtils.split(exporterID, ',')))
                .collect(Collectors.toList()));
        return taskQueryParam;
    }
}
