/*
 * **** BEGIN LICENSE BLOCK *****
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
 * **** END LICENSE BLOCK *****
 *
 */

package org.dcm4chee.arc.ups.rs;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.dcm4che3.data.*;
import org.dcm4che3.util.UIDUtils;
import org.dcm4chee.arc.conf.ArchiveAEExtension;
import org.dcm4chee.arc.conf.ArchiveDeviceExtension;
import org.dcm4chee.arc.entity.UPS;
import org.dcm4chee.arc.keycloak.HttpServletRequestInfo;
import org.dcm4chee.arc.ups.UPSContext;
import org.dcm4chee.arc.ups.UPSService;
import org.dcm4chee.arc.ups.UPSUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.core.Response;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;

/**
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since July 2020
 */
class UpsCSV {
    private static final Logger LOG = LoggerFactory.getLogger(UpsCSV.class);
    private static final IDWithIssuer dummyPatientID = new IDWithIssuer("DummyPID^^^DummyIssuer");

    private final UPSService upsService;
    private final HttpServletRequestInfo httpServletRequestInfo;
    private final ArchiveAEExtension arcAE;
    private final Attributes upsTemplateAttrs;

    public UpsCSV(UPSService upsService, HttpServletRequestInfo httpServletRequestInfo,
                  ArchiveAEExtension arcAE, Attributes upsTemplateAttrs) {
        this.upsService = upsService;
        this.httpServletRequestInfo = httpServletRequestInfo;
        this.arcAE = arcAE;
        this.upsTemplateAttrs = upsTemplateAttrs;
    }

    Response createWorkitems(int studyUIDField, int patientIDField, String movescp, InputStream in) {
        Response.Status status = Response.Status.NO_CONTENT;
        int count = 0;
        String warning = null;
        ArchiveDeviceExtension arcDev = arcAE.getApplicationEntity().getDevice()
                                             .getDeviceExtensionNotNull(ArchiveDeviceExtension.class);
        int csvUploadChunkSize = arcDev.getCSVUploadChunkSize();
        Map<String, IDWithIssuer> studyPatientMap = new HashMap<>();
        try (
                BufferedReader reader = new BufferedReader(new InputStreamReader(in));
                CSVParser parser = new CSVParser(reader, CSVFormat.DEFAULT.builder()
                                                                          .setDelimiter(csvDelimiter())
                                                                          .build())
        ) {
            boolean header = true;
            IDWithIssuer pid = dummyPatientID;
            for (CSVRecord csvRecord : parser) {
                if (csvRecord.size() == 0 || csvRecord.get(0).isEmpty())
                    continue;

                String studyUID = csvRecord.get(studyUIDField - 1).replaceAll("\"", "");
                if (header && studyUID.chars().allMatch(Character::isLetter)) {
                    header = false;
                    continue;
                }

                if (!arcDev.isValidateUID() || validateUID(studyUID)) {
                    if (patientIDField > 0)
                        pid = new IDWithIssuer(csvRecord.get(patientIDField - 1).replaceAll("\"", ""));
                    studyPatientMap.put(studyUID, pid);
                }

                if (studyPatientMap.size() == csvUploadChunkSize) {
                    count += createUPSRecords(studyPatientMap, movescp);
                    studyPatientMap.clear();
                }
            }

            if (!studyPatientMap.isEmpty())
                count += createUPSRecords(studyPatientMap, movescp);

            if (count == 0)
                warning = "Empty file or Incorrect field position or Not a CSV file or Invalid UIDs.";
        } catch (Exception e) {
            warning = e.getMessage();
            status = Response.Status.INTERNAL_SERVER_ERROR;
        }
        if (warning == null && count > 0)
            return Response.accepted(count(count)).build();

        LOG.warn("Response {} caused by {}", status, warning);
        Response.ResponseBuilder builder = Response.status(status)
                .header("Warning", warning);
        if (count > 0)
            builder.entity(count(count));

        return builder.build();
    }

    private int createUPSRecords(Map<String, IDWithIssuer> studyPatientMap, String movescp) {
        int count = 0;
        for (Map.Entry<String, IDWithIssuer> studyPatient : studyPatientMap.entrySet()) {
            try {
                UPSContext ctx = upsService.newUPSContext(httpServletRequestInfo, arcAE);
                ctx.setUPSInstanceUID(UIDUtils.createUID());
                UPSUtils.updateUPSTemplateAttrs(arcAE, upsTemplateAttrs, studyPatient, movescp);
                ctx.setAttributes(upsTemplateAttrs);
                UPS ups = upsService.createUPS(ctx);
                LOG.info("UPSTemplateWorkitem[uid={}]: created {}", upsTemplateAttrs.getString(Tag.SOPInstanceUID), ups);
                count++;
            } catch (Exception e) {
                LOG.info("UPSTemplateWorkitem[uid={}]: create UPS failed for Study[uid={}] of Patient[id={}]\n",
                        upsTemplateAttrs.getString(Tag.SOPInstanceUID),
                        studyPatient.getKey(),
                        studyPatient.getValue(),
                        e);
            }
        }
        return count;
    }

    private char csvDelimiter() {
        return ("semicolon".equals(httpServletRequestInfo.getContentType().getParameters().get("delimiter")))
                ? ';' : ',';
    }

    private boolean validateUID(String uid) {
        boolean valid = UIDUtils.isValid(uid);
        if (!valid)
            LOG.warn("Invalid UID in CSV file: " + uid);
        return valid;
    }

    private static String count(int count) {
        return "{\"count\":" + count + '}';
    }
}
