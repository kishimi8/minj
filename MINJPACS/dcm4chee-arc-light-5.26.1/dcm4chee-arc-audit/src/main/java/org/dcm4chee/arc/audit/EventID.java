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
 * *** END LICENSE BLOCK *****
 */

package org.dcm4chee.arc.audit;

import org.dcm4che3.audit.AuditMessages;
import org.dcm4che3.audit.EventIdentification;
import org.dcm4che3.audit.EventIdentificationBuilder;
import org.dcm4che3.data.Code;
import org.dcm4che3.net.audit.AuditLogger;
import org.dcm4chee.arc.entity.Patient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Calendar;
import java.util.HashSet;

/**
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Feb 2019
 */
class EventID {
    private final static Logger LOG = LoggerFactory.getLogger(EventID.class);

    static EventIdentification toEventIdentification(
            AuditLogger auditLogger, Path path, AuditUtils.EventType eventType, AuditInfo auditInfo) {
        Event event = new Event(auditInfo, eventType);
        return new EventIdentificationBuilder(
                eventType.eventID,
                eventType.eventActionCode,
                getEventTime(path, auditLogger),
                event.outcomeIndicator)
                .outcomeDesc(event.outcomeDescription)
                .eventTypeCode(event.eventTypeCode)
                .build();
    }

    static EventIdentification toEventIdentification(AuditUtils.EventType eventType) {
        return new EventIdentificationBuilder(
                eventType.eventID,
                eventType.eventActionCode,
                null,
                AuditMessages.EventOutcomeIndicator.Success)
                .eventTypeCode(eventType.eventTypeCode)
                .build();
    }

    static EventIdentification toEventIdentification(
            AuditLogger auditLogger, Path path, AuditUtils.EventType eventType, HashSet<String> outcome,
            HashSet<AuditMessages.EventTypeCode> errorCode) {
        return new EventIdentificationBuilder(
                eventType.eventID,
                eventType.eventActionCode,
                getEventTime(path, auditLogger),
                AuditMessages.EventOutcomeIndicator.MinorFailure)
                .outcomeDesc(String.join("\n", outcome))
                .eventTypeCode(errorCode.toArray(new AuditMessages.EventTypeCode[0]))
                .build();
    }

    private static Calendar getEventTime(Path path, AuditLogger auditLogger){
        Calendar eventTime = auditLogger.timeStamp();
        try {
            eventTime.setTimeInMillis(Files.getLastModifiedTime(path).toMillis());
        } catch (Exception e) {
            LOG.info("Failed to get Last Modified Time of [AuditSpoolFile={}] of [AuditLogger={}]\n",
                    path, auditLogger.getCommonName(), e);
        }
        return eventTime;
    }

    static class Event {
        private String outcomeIndicator;
        private String outcomeDescription;
        private AuditMessages.EventTypeCode eventTypeCode;

        Event(AuditInfo auditInfo, AuditUtils.EventType eventType) {
            String patMismatchCode = auditInfo.getField(AuditInfo.PAT_MISMATCH_CODE);
            String patVerStatus = auditInfo.getField(AuditInfo.PAT_VERIFICATION_STATUS);
            Patient.VerificationStatus patVerificationStatus = patVerStatus != null
                    ? Patient.VerificationStatus.valueOf(patVerStatus) : null;
            String outcome = auditInfo.getField(AuditInfo.OUTCOME);
            String status = auditInfo.getField(AuditInfo.STATUS);

            this.eventTypeCode = patMismatchCode != null
                    ? patMismatchEventTypeCode(patMismatchCode) : eventType.eventTypeCode;

            this.outcomeIndicator = outcome != null || patMismatchCode != null
                    || patVerificationStatus == Patient.VerificationStatus.NOT_FOUND
                        ? AuditMessages.EventOutcomeIndicator.MinorFailure
                        : patVerificationStatus == Patient.VerificationStatus.VERIFICATION_FAILED
                            ? AuditMessages.EventOutcomeIndicator.SeriousFailure
                            : AuditMessages.EventOutcomeIndicator.Success;

            this.outcomeDescription = eventTypeCode != null
                    ? eventTypeCode.getOriginalText()
                    : outcome != null
                        ? patVerificationStatus != null
                            ? patVerificationStatus.name() + " " + outcome
                            : status != null
                                ? status + " " + outcome
                                : outcome
                        : patVerificationStatus != null
                            ? patVerificationStatus.name()
                            : status != null
                                ? status
                                : auditInfo.getField(AuditInfo.WARNING);
        }

        private AuditMessages.EventTypeCode patMismatchEventTypeCode(String patMismatchCode) {
            try {
                Code code = new Code(patMismatchCode);
                return new AuditMessages.EventTypeCode(
                        code.getCodeValue(),
                        code.getCodingSchemeDesignator(),
                        code.getCodeMeaning());
            } catch (Exception e) {
                LOG.info("Invalid patient mismatch code: {}", patMismatchCode);
            }
            return null;
        }
    }
}