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
 * Portions created by the Initial Developer are Copyright (C) 2015-2020
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
package org.dcm4chee.arc.audit;

import org.dcm4che3.audit.ActiveParticipant;
import org.dcm4che3.audit.ActiveParticipantBuilder;
import org.dcm4che3.audit.AuditMessage;
import org.dcm4che3.audit.AuditMessages;
import org.dcm4che3.net.audit.AuditLogger;
import org.dcm4chee.arc.entity.Task;
import org.dcm4chee.arc.event.BulkTaskEvent;
import org.dcm4chee.arc.event.TaskEvent;
import org.dcm4chee.arc.keycloak.KeycloakContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.Json;
import javax.json.stream.JsonGenerator;
import javax.servlet.http.HttpServletRequest;
import java.io.StringWriter;
import java.nio.file.Path;

/**
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Oct 2018
 */
class TaskAuditService {

    private final static Logger LOG = LoggerFactory.getLogger(TaskAuditService.class);

    static AuditInfoBuilder queueMsgAuditInfo(TaskEvent queueMsgEvent) {
        HttpServletRequest req = queueMsgEvent.getRequest();
        Task queueMsg = queueMsgEvent.getTask();
        return new AuditInfoBuilder.Builder()
                .callingUserID(KeycloakContext.valueOf(req).getUserName())
                .callingHost(req.getRemoteHost())
                .calledUserID(req.getRequestURI())
                .outcome(outcome(queueMsgEvent.getException()))
                .queueMsg(toString(queueMsg))
                .taskPOID(Long.toString(queueMsg.getPk()))
                .build();
    }

    static AuditInfoBuilder bulkQueueMsgAuditInfo(BulkTaskEvent bulkQueueMsgEvent, String callingUser) {
        HttpServletRequest req = bulkQueueMsgEvent.getRequest();
        AuditInfoBuilder.Builder builder = new AuditInfoBuilder.Builder()
                .callingUserID(callingUser)
                .outcome(outcome(bulkQueueMsgEvent.getException()))
                .count(bulkQueueMsgEvent.getCount())
                .failed(bulkQueueMsgEvent.getFailed())
                .taskPOID(bulkQueueMsgEvent.getOperation().name());
        return req != null
                ? builder.callingHost(req.getRemoteHost())
                        .calledUserID(req.getRequestURI())
                        .filters(req.getQueryString())
                        .build()
                : builder
                    .queueName(bulkQueueMsgEvent.getQueueName())
                    .build();
    }

    static AuditMessage auditMsg(AuditLogger auditLogger, Path path, AuditUtils.EventType eventType) {
        SpoolFileReader reader = new SpoolFileReader(path);
        AuditInfo auditInfo = new AuditInfo(reader.getMainInfo());
        return AuditMessages.createMessage(
                EventID.toEventIdentification(auditLogger, path, eventType, auditInfo),
                activeParticipants(auditInfo, auditLogger),
                ParticipantObjectID.taskParticipant(auditInfo));
    }

    private static ActiveParticipant[] activeParticipants(AuditInfo auditInfo, AuditLogger auditLogger) {
        ActiveParticipant[] activeParticipants;
        String callingUserID = auditInfo.getField(AuditInfo.CALLING_USERID);
        String calledUserID = auditInfo.getField(AuditInfo.CALLED_USERID);
        if (calledUserID == null) {
            activeParticipants = new ActiveParticipant[1];
            activeParticipants[0] = new ActiveParticipantBuilder(
                    callingUserID,
                    auditLogger.getConnections().get(0).getHostname())
                    .userIDTypeCode(AuditMessages.UserIDTypeCode.DeviceName)
                    .isRequester().build();
        } else {
            activeParticipants = new ActiveParticipant[2];
            activeParticipants[0] = new ActiveParticipantBuilder(
                    callingUserID,
                    auditInfo.getField(AuditInfo.CALLING_HOST))
                    .userIDTypeCode(AuditMessages.userIDTypeCode(callingUserID))
                    .isRequester().build();
            activeParticipants[1] = new ActiveParticipantBuilder(
                    calledUserID,
                    auditLogger.getConnections().get(0).getHostname())
                    .userIDTypeCode(AuditMessages.UserIDTypeCode.URI)
                    .build();
        }
        return activeParticipants;
    }

    private static String outcome(Exception e) {
        return e != null ? e.getMessage() : null;
    }

    private static String toString(Task task) {
        StringWriter w = new StringWriter(256);
        try (JsonGenerator gen = Json.createGenerator(w)){
            task.writeAsJSON(gen);
        }
        return w.toString();
    }
}
