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

package org.dcm4chee.arc.ups.impl;

import org.dcm4che3.conf.api.ConfigurationException;
import org.dcm4che3.conf.api.ConfigurationNotFoundException;
import org.dcm4che3.conf.api.IApplicationEntityCache;
import org.dcm4che3.data.*;
import org.dcm4che3.dcmr.ScopeOfAccumulation;
import org.dcm4che3.hl7.HL7Charset;
import org.dcm4che3.io.SAXTransformer;
import org.dcm4che3.io.TemplatesCache;
import org.dcm4che3.net.*;
import org.dcm4che3.net.hl7.HL7Application;
import org.dcm4che3.net.hl7.HL7DeviceExtension;
import org.dcm4che3.net.hl7.HL7SAXTransformer;
import org.dcm4che3.net.hl7.UnparsedHL7Message;
import org.dcm4che3.net.service.DicomServiceException;
import org.dcm4che3.util.ReverseDNS;
import org.dcm4che3.util.StringUtils;
import org.dcm4chee.arc.HL7ConnectionEvent;
import org.dcm4chee.arc.conf.*;
import org.dcm4chee.arc.entity.UPS;
import org.dcm4chee.arc.event.ArchiveServiceEvent;
import org.dcm4chee.arc.keycloak.HttpServletRequestInfo;
import org.dcm4chee.arc.query.Query;
import org.dcm4chee.arc.query.QueryContext;
import org.dcm4chee.arc.query.QueryService;
import org.dcm4chee.arc.query.util.QueryAttributes;
import org.dcm4chee.arc.query.util.QueryParam;
import org.dcm4chee.arc.store.StoreContext;
import org.dcm4chee.arc.store.StoreSession;
import org.dcm4chee.arc.ups.UPSContext;
import org.dcm4chee.arc.ups.UPSEvent;
import org.dcm4chee.arc.ups.UPSService;
import org.dcm4chee.arc.ups.UPSUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.xml.sax.SAXException;

import javax.ejb.EJBException;
import javax.enterprise.context.ApplicationScoped;
import javax.enterprise.event.Event;
import javax.enterprise.event.Observes;
import javax.inject.Inject;
import javax.websocket.Session;
import javax.xml.transform.TransformerConfigurationException;
import java.io.IOException;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Sep 2019
 */
@ApplicationScoped
public class UPSServiceImpl implements UPSService {

    private static final Logger LOG = LoggerFactory.getLogger(UPSServiceImpl.class);
    private static final IOD CREATE_IOD = loadIOD("create-iod.xml");
    private static final IOD CREATE_TEMPLATE_IOD = loadIOD("create-template-iod.xml");
    private static final IOD SET_IOD = loadIOD("set-iod.xml");

    private final ConcurrentHashMap<String, WSChannel> websocketChannels = new ConcurrentHashMap<>();

    @Inject
    private UPSServiceEJB ejb;

    @Inject
    private QueryService queryService;

    @Inject
    private Event<UPSEvent> upsEvent;

    @Inject
    private IApplicationEntityCache aeCache;

    @Inject
    private Device device;

    @Override
    public UPSContext newUPSContext(Association as) {
        return new UPSContextImpl(as);
    }

    @Override
    public UPSContext newUPSContext(HttpServletRequestInfo httpRequestInfo, ArchiveAEExtension arcAE) {
        return new UPSContextImpl(httpRequestInfo, arcAE);
    }

    @Override
    public UPSContext newUPSContext(UPSContext other) {
        return new UPSContextImpl(other);
    }

    @Override
    public UPS createUPS(UPSContext ctx) throws DicomServiceException {
        Attributes attrs = ctx.getAttributes();
        ValidationResult validate = attrs.validate(ctx.isTemplate() ? CREATE_TEMPLATE_IOD : CREATE_IOD);
        if (!validate.isValid()) {
            throw DicomServiceException.valueOf(validate, attrs);
        }
        if (ctx.isGlobalSubscription()) {
            throw new DicomServiceException(Status.DuplicateSOPinstance,
                    "Cannot create UPS Global Subscription SOP Instance", false);
        }
        if (!"SCHEDULED".equals(attrs.getString(Tag.ProcedureStepState))) {
            throw new DicomServiceException(Status.UPSNotScheduled,
                    "The provided value of UPS State was not SCHEDULED");
        }
        if (!attrs.containsValue(Tag.WorklistLabel)) {
            attrs.setString(Tag.WorklistLabel, VR.LO, ctx.getArchiveAEExtension().upsWorklistLabel());
        }
        try {
            UPS ups = ejb.createUPS(ctx);
            fireUPSEvents(ctx);
            return ups;
        } catch (Exception e) {
            if (upsExists(ctx))
                throw new DicomServiceException(Status.DuplicateSOPinstance,
                        "The UPS already exists.", false);

            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    private boolean upsExists(UPSContext ctx) throws DicomServiceException {
        try {
            return ejb.exists(ctx);
        } catch (Exception e) {
            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    @Override
    public UPS updateUPS(UPSContext ctx) throws DicomServiceException {
        Attributes attrs = ctx.getAttributes();
        ValidationResult validate = attrs.validate(SET_IOD);
        if (!validate.isValid()) {
            throw DicomServiceException.valueOf(validate, attrs);
        }
        try {
            UPS ups = ejb.updateUPS(ctx);
            fireUPSEvents(ctx);
            return ups;
        } catch (DicomServiceException e) {
            throw e;
        } catch (Exception e) {
             throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    @Override
    public UPS changeUPSState(UPSContext ctx) throws DicomServiceException {
        Attributes attrs = ctx.getAttributes();
        String transactionUID = attrs.getString(Tag.TransactionUID);
        if (transactionUID == null)
            throw new DicomServiceException(Status.InvalidArgumentValue,
                    "The Transaction UID is missing.", false);
        UPSState upsState;
        try {
            upsState = UPSState.fromString(attrs.getString(Tag.ProcedureStepState));
        } catch (NullPointerException e) {
            throw new DicomServiceException(Status.InvalidArgumentValue,
                    "The Procedure Step State is missing.", false);
        } catch (IllegalArgumentException e) {
            throw new DicomServiceException(Status.InvalidArgumentValue,
                    "The Procedure Step State is invalid.", false);
        }
        if (upsState == UPSState.SCHEDULED) {
            throw new DicomServiceException(Status.UPSStateMayNotChangedToScheduled,
                    "The submitted request is inconsistent with the current state of the UPS Instance.", false);
        }
        try {
            UPS ups = ejb.changeUPSState(ctx, upsState, transactionUID);
            fireUPSEvents(ctx);
            if (upsState == UPSState.COMPLETED) onUPSCompleted(ctx, ups);
            return ups;
        } catch (DicomServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    private void onUPSCompleted(UPSContext ctx, UPS ups) {
        Calendar now = Calendar.getInstance();
        ctx.getArchiveAEExtension().upsOnUPSCompletedStream()
                .filter(rule -> rule.getConditions()
                        .match(ctx.getRemoteHostName(),
                                ctx.getRequesterAET(),
                                ctx.getLocalHostName(),
                                ctx.getApplicationEntity().getAETitle(),
                                ups.getAttributes()))
                .peek(rule -> LOG.info("Apply {} on completion of {}", rule, ups))
                .filter(rule -> isRequiredOtherUPSCompleted(ctx, ups, rule))
                .forEach(rule -> createUPSOnUPSCompleted(ctx, ups, rule, now));
    }

    private boolean isRequiredOtherUPSCompleted(UPSContext ctx, UPS ups, UPSOnUPSCompleted rule) {
        String[] requiresOtherUPSCompleted;
        Attributes item;
        String refStudyIUID;
        if ((requiresOtherUPSCompleted = rule.getRequiresOtherUPSCompleted()).length > 0
                && (item = ups.getAttributes().getNestedDataset(Tag.ReferencedRequestSequence)) != null
                && (refStudyIUID = item.getString(Tag.StudyInstanceUID)) != null) {
            for (String queryString : requiresOtherUPSCompleted) {
                try (Query query = queryService.createUPSQuery(
                        queryContextUPSNotCompleted(ctx, refStudyIUID, queryString))) {
                    long notCompleted = query.fetchCount();
                    if (notCompleted > 0) {
                        LOG.info("Suspend {} on completion of {} caused by {} not completed required other UPS",
                                rule, ups, notCompleted);
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private QueryContext queryContextUPSNotCompleted(UPSContext ctx, String refStudyIUID, String queryString) {
        QueryParam queryParam = new QueryParam(ctx.getApplicationEntity());
        queryParam.setCombinedDatetimeMatching(true);
        QueryContext queryContext = queryService.newQueryContext(ctx.getApplicationEntity(), queryParam);
        queryContext.setQueryKeys(queryKeysUPSNotCompleted(refStudyIUID, queryString));
        return queryContext;
    }

    private static Attributes queryKeysUPSNotCompleted(String refStudyIUID, String queryString) {
        Attributes keys = new QueryAttributes(QueryAttributes.parseQueryString(queryString), null)
                .getQueryKeys();
        Attributes item = new Attributes(1);
        item.setString(Tag.StudyInstanceUID, VR.UI, refStudyIUID);
        keys.newSequence(Tag.ReferencedRequestSequence, 1).add(item);
        keys.setString(Tag.ProcedureStepState, VR.CS, "SCHEDULED", "IN PROGRESS", "CANCELED");
        return keys;
    }

    private void createUPSOnUPSCompleted(UPSContext ctx, UPS prevUPS, UPSOnUPSCompleted rule, Calendar now) {
        UPSContext upsCtx = newUPSContext(ctx);
        upsCtx.setUPSInstanceUID(rule.getInstanceUID(prevUPS.getAttributes()));
        upsCtx.setAttributes(upsOnCompleted(upsCtx, prevUPS, now, rule));
        try {
            createUPS(upsCtx);
        } catch (DicomServiceException e) {
            LOG.info("Failed to apply {} create on completion of {}", rule, prevUPS, e);
        }
    }

    @Override
    public UPS requestUPSCancel(UPSContext ctx) throws DicomServiceException {
        try {
            UPS ups = ejb.requestUPSCancel(ctx, this);
            fireUPSEvents(ctx);
            return ups;
        } catch (DicomServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    @Override
    public UPS findUPS(UPSContext ctx) throws DicomServiceException {
        UPS ups = ejb.findUPS(ctx);
        Attributes upsAttrs = ups.getAttributes();
        Attributes patAttrs = ups.getPatient().getAttributes();
        Attributes.unifyCharacterSets(patAttrs, upsAttrs);
        Attributes attrs = new Attributes(patAttrs.size() + upsAttrs.size() + 3);
        attrs.addAll(patAttrs);
        attrs.addAll(upsAttrs);
        attrs.setString(Tag.SOPClassUID, VR.UI, UID.UnifiedProcedureStepPush);
        attrs.setString(Tag.SOPInstanceUID, VR.UI, ups.getUPSInstanceUID());
        attrs.setDate(Tag.ScheduledProcedureStepModificationDateTime, VR.DT, ups.getUpdatedTime());
        ctx.setAttributes(attrs);
        return ups;
    }

    @Override
    public void createSubscription(UPSContext ctx) throws DicomServiceException {
        validateSupportEventReports(ctx);
        try {
            validateSubscriberAET(ctx);
            switch (ctx.getUPSInstanceUID()) {
                case UID.UPSFilteredGlobalSubscriptionInstance:
                    if (ctx.getAttributes().isEmpty()) {
                        throw new DicomServiceException(Status.InvalidArgumentValue,
                                "Matching Keys are missing.", false);
                    }
                case UID.UPSGlobalSubscriptionInstance:
                    ejb.createOrUpdateGlobalSubscription(ctx, searchNotSubscribedUPS(ctx));
                    break;
                default:
                    ejb.createOrUpdateSubscription(ctx);
            }
            fireUPSEvents(ctx);
        } catch (DicomServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    @Override
    public int deleteSubscription(UPSContext ctx) throws DicomServiceException {
        try {
            return ctx.isGlobalSubscription()
                    ? ejb.deleteGlobalSubscription(ctx)
                    : ejb.deleteSubscription(ctx);
        } catch (Exception e) {
            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    @Override
    public int suspendSubscription(UPSContext ctx) throws DicomServiceException {
        try {
            return ctx.isGlobalSubscription()
                    ? ejb.suspendGlobalSubscription(ctx)
                    : ejb.deleteSubscription(ctx);
        } catch (Exception e) {
            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
    }

    @Override
    public void registerWebsocketChannel(Session session, String aet, String subscriberAET) {
        websocketChannels.put(session.getId(), new WSChannel(session, aet, subscriberAET));
    }

    @Override
    public void unregisterWebsocketChannel(Session session) {
        websocketChannels.remove(session.getId());
    }

    @Override
    public List<Session> getWebsocketChannels(String subscriberAET) {
        return websocketChannels.values().stream()
                .filter(ws -> ws.subscriberAET.equals(subscriberAET))
                .map(ws -> ws.session)
                .collect(Collectors.toList());
    }

    public void onArchiveServiceEvent(@Observes ArchiveServiceEvent event) {
        Attributes eventInformation = new Attributes(3);
        switch (event.getType()) {
            case STARTED:
                eventInformation.setString(Tag.SCPStatus, VR.CS, "RESTARTED");
                eventInformation.setString(Tag.SubscriptionListStatus, VR.CS, "WARM START");
                eventInformation.setString(Tag.UnifiedProcedureStepListStatus, VR.CS, "WARM START");
                break;
            case STOPPED:
                eventInformation.setString(Tag.SCPStatus, VR.CS, "GOING DOWN");
                break;
            case RELOADED:
                return;
        }
        try {
            device.getApplicationEntities().stream().filter(UPSServiceImpl::isUPSEventSCP).forEach(
                    ae -> ejb.statusChangeEvents(ae.getAEExtensionNotNull(ArchiveAEExtension.class), eventInformation)
                            .forEach(upsEvent::fire));
        } catch (Exception e) {
            LOG.info("Failed to send StatusChange Event Reports - {}", e.getMessage());
        }
    }

    public void onStore(@Observes StoreContext ctx) {
        if (ctx.getStoredInstance() == null || ctx.getException() != null)
            return;

        StoreSession session = ctx.getStoreSession();
        Calendar now = Calendar.getInstance();
        ArchiveAEExtension arcAE = session.getArchiveAEExtension();
        ArchiveDeviceExtension arcDev = arcAE.getArchiveDeviceExtension();
        arcAE.upsOnStoreStream()
                .filter(upsOnStore -> upsOnStore.match(now,
                                        session.getRemoteHostName(),
                                        session.getCallingAET(),
                                        session.getLocalHostName(),
                                        session.getCalledAET(),
                                        ctx.getAttributes()))
                .forEach(upsOnStore -> createOrUpdateOnStore(arcDev, ctx, now, upsOnStore));
    }

    private void createOrUpdateOnStore(ArchiveDeviceExtension arcDev, StoreContext ctx, Calendar now, UPSOnStore upsOnStore) {
        int retries = arcDev.getStoreUpdateDBMaxRetries();
        for (;;) {
            try {
                UPSContext upsContext = ejb.createOrUpdateOnStore(ctx, now, upsOnStore);
                if (upsContext != null)
                    fireUPSEvents(upsContext);
                return;
            } catch (EJBException e) {
                if (retries-- > 0) {
                    LOG.info("{}: Failed to create or update UPS triggered by {} caused by {} - retry",
                            ctx.getStoreSession(), upsOnStore, DicomServiceException.initialCauseOf(e));
                } else {
                    LOG.warn("{}: Failed to create or update UPS triggered by {}:\n",
                            ctx.getStoreSession(), upsOnStore, e);
                    return;
                }
            }
            try {
                Thread.sleep(arcDev.storeUpdateDBRetryDelay());
            } catch (InterruptedException e) {
                LOG.info("{}: Failed to delay retry to create or update UPS triggered by {}:\n",
                        ctx.getStoreSession(), upsOnStore, e);
            }
        }
    }

    public void onHL7Connection(@Observes HL7ConnectionEvent event) {
        if (event.getType() != HL7ConnectionEvent.Type.MESSAGE_PROCESSED || event.getException() != null)
            return;

        UnparsedHL7Message msg = event.getHL7Message();
        HL7Application hl7App = device.getDeviceExtension(HL7DeviceExtension.class)
                .getHL7Application(msg.msh().getReceivingApplicationWithFacility(), true);
        if (hl7App == null)
            return;

        ArchiveHL7ApplicationExtension arcHL7App =
                hl7App.getHL7ApplicationExtension(ArchiveHL7ApplicationExtension.class);
        if (arcHL7App == null || !arcHL7App.hasUPSOnHL7())
            return;

        Socket socket = event.getSocket();
        String host = ReverseDNS.hostNameOf(socket.getInetAddress());
        HL7Fields hl7Fields = new HL7Fields(msg, hl7App.getHL7DefaultCharacterSet());
        Calendar now = Calendar.getInstance();
        arcHL7App.upsOnHL7Stream()
                .filter(upsOnHL7 -> upsOnHL7.getConditions().match(host, hl7Fields))
                .forEach(upsOnHL7 -> createOnHL7(socket, arcHL7App, msg, hl7Fields, now, upsOnHL7));
    }

    private void createOnHL7(
            Socket socket, ArchiveHL7ApplicationExtension arcHL7App, UnparsedHL7Message msg, HL7Fields hl7Fields,
            Calendar now, UPSOnHL7 upsOnHL7) {
        LOG.info("{}: Apply {}", socket, upsOnHL7);
        UPSContext ctx = new UPSContextImpl(socket, arcHL7App);
        ctx.setUPSInstanceUID(upsOnHL7.getInstanceUID(hl7Fields));
        try {
            UPS ups = ejb.findUPS(ctx);
            LOG.info("UPS {} exists, return", ups);
        } catch (DicomServiceException e) {
            createOnHL7(ctx, arcHL7App, msg, hl7Fields, now, upsOnHL7);
        }
    }

    private void createOnHL7(
            UPSContext ctx, ArchiveHL7ApplicationExtension arcHL7App, UnparsedHL7Message msg, HL7Fields hl7Fields,
            Calendar now, UPSOnHL7 upsOnHL7) {
        Attributes attrs = applyXSLT(arcHL7App, msg, upsOnHL7);
        if (attrs.size() == 0)
            return;

        ctx.setAttributes(UPSUtils.createOnHL7(arcHL7App, attrs, hl7Fields, now, upsOnHL7));
        try {
            createUPS(ctx);
        } catch (DicomServiceException e) {
            LOG.info("Failed to apply {} to create UPS", upsOnHL7, e);
        }
    }

    private Attributes applyXSLT(
            ArchiveHL7ApplicationExtension arcHL7App, UnparsedHL7Message msg, UPSOnHL7 upsOnHL7) {
        try {
            String hl7Charset = msg.msh().getField(17, arcHL7App.getHL7Application().getHL7DefaultCharacterSet());
            return HL7SAXTransformer.transform(
                    msg.unescapeXdddd(),
                    hl7Charset,
                    arcHL7App.hl7DicomCharacterSet() != null
                            ? arcHL7App.hl7DicomCharacterSet()
                            : HL7Charset.toDicomCharacterSetCode(hl7Charset),
                    TemplatesCache.getDefault().get(StringUtils.replaceSystemProperties(upsOnHL7.getXSLTStylesheetURI())),
                    null);
        } catch (SAXException e) {
            LOG.warn("Failed to apply XSL: {}", upsOnHL7.getXSLTStylesheetURI(), e);
        } catch (TransformerConfigurationException e) {
            LOG.warn("Failed to compile XSL: {}", upsOnHL7.getXSLTStylesheetURI(), e);
        } catch (IOException e) {
            LOG.warn("Failed to parse HL7 Message{}: {}", msg, upsOnHL7.getXSLTStylesheetURI(), e);
        }
        return new Attributes();
    }

    boolean websocketChannelsExists(String subscriberAET) {
        return websocketChannels.values().stream().anyMatch(ws -> ws.subscriberAET.equals(subscriberAET));
    }

    private void fireUPSEvents(UPSContext ctx) {
        if (ctx.isTemplate())
            return;

        try {
            ctx.getUPSEvents().forEach(upsEvent::fire);
        } catch (Exception e) {
            LOG.warn("Failed to send Event Reports\n", e);
        }
    }

    private static IOD loadIOD(String name) {
        try {
            IOD iod = new IOD();
            iod.parse(UPSServiceImpl.class.getResource(name).toString());
            iod.trimToSize();
            return iod;
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private void validateSupportEventReports(UPSContext ctx) throws DicomServiceException {
        if (!isUPSEventSCP(ctx.getApplicationEntity())) {
            throw new DicomServiceException(Status.UPSDoesNotSupportEventReports,
                    "Event Reports are not supported");
        }
    }

    private static boolean isUPSEventSCP(ApplicationEntity ae) {
        return ae.getTransferCapabilityFor(
                UID.UnifiedProcedureStepWatch, TransferCapability.Role.SCP) != null;
    }

    private void validateSubscriberAET(UPSContext ctx) throws DicomServiceException, ConfigurationException {
        if (ctx.getArchiveAEExtension().isUPSEventSCU(ctx.getSubscriberAET())) {
            try {
                aeCache.findApplicationEntity(ctx.getSubscriberAET());
            } catch (ConfigurationNotFoundException e) {
                throw new DicomServiceException(Status.UPSUnknownReceivingAET, e);
            }
        }
    }

    private List<Attributes> searchNotSubscribedUPS(UPSContext ctx) throws DicomServiceException {
        List<Attributes> list = new ArrayList<>();
        ApplicationEntity ae = ctx.getApplicationEntity();
        ArchiveDeviceExtension arcdev = ctx.getArchiveDeviceExtension();
        QueryParam queryParam = new QueryParam(ae);
        queryParam.setNotSubscribedByAET(ctx.getSubscriberAET());
        QueryContext queryContext = queryService.newQueryContext(ae, queryParam);
        Attributes matchKeys = ctx.getAttributes();
        if (matchKeys != null) {
            IDWithIssuer idWithIssuer = IDWithIssuer.pidOf(matchKeys);
            if (idWithIssuer != null && !idWithIssuer.getID().equals("*"))
                queryContext.setPatientIDs(idWithIssuer);
            else if (ctx.getArchiveAEExtension().filterByIssuerOfPatientID())
                queryContext.setIssuerOfPatientID(Issuer.fromIssuerOfPatientID(matchKeys));
            queryContext.setQueryKeys(matchKeys);
        } else {
            queryContext.setQueryKeys(new Attributes(0));
        }
        try (Query query = queryService.createUPSWithoutQueryEvent(queryContext)) {
            query.executeQuery(arcdev.getQueryFetchSize());
            while (query.hasMoreMatches()) {
                list.add(query.nextMatch());
            }
        }
        return list;
    }

    private static class WSChannel {
        final Session session;
        final String aet;
        final String subscriberAET;

        private WSChannel(Session session, String aet, String subscriberAET) {
            this.session = session;
            this.aet = aet;
            this.subscriberAET = subscriberAET;
        }
    }

    private Attributes upsOnCompleted(UPSContext upsCtx, UPS prevUPS, Calendar now, UPSOnUPSCompleted rule) {
        Attributes prevUPSAttrs = prevUPS.getAttributes();
        Attributes attrs = applyXSLT(rule, prevUPS);
        if (rule.isIncludeStudyInstanceUID() && !attrs.contains(Tag.StudyInstanceUID))
            attrs.setString(Tag.StudyInstanceUID, VR.UI, prevUPSAttrs.getString(Tag.StudyInstanceUID));
        if (!attrs.contains(Tag.AdmissionID)) {
            attrs.setString(Tag.AdmissionID, VR.LO, rule.getAdmissionID(prevUPSAttrs));
            UPSUtils.setIssuer(attrs, Tag.IssuerOfAdmissionID, rule.getIssuerOfAdmissionID());
        }
        if (!attrs.contains(Tag.ScheduledProcedureStepStartDateTime))
            attrs.setDate(Tag.ScheduledProcedureStepStartDateTime, VR.DT, UPSUtils.add(now, rule.getStartDateTimeDelay()));
        if (rule.getCompletionDateTimeDelay() != null && !attrs.contains(Tag.ExpectedCompletionDateTime))
            attrs.setDate(Tag.ExpectedCompletionDateTime, VR.DT, UPSUtils.add(now, rule.getCompletionDateTimeDelay()));
        if (rule.getScheduledHumanPerformers().length > 0 && !attrs.contains(Tag.ScheduledHumanPerformersSequence))
            UPSUtils.setScheduledHumanPerformerItems(attrs,
                    rule.getScheduledHumanPerformers(),
                    rule.getScheduledHumanPerformerName(attrs),
                    rule.getScheduledHumanPerformerOrganization(attrs));
        if (!attrs.contains(Tag.ScheduledWorkitemCodeSequence))
            UPSUtils.setCode(attrs, Tag.ScheduledWorkitemCodeSequence, rule.getScheduledWorkitemCode());
        if (!attrs.contains(Tag.ScheduledStationNameCodeSequence))
            UPSUtils.setCodes(attrs, Tag.ScheduledStationNameCodeSequence, rule.getScheduledStationNames());
        if (!attrs.contains(Tag.ScheduledStationClassCodeSequence))
            UPSUtils.setCodes(attrs, Tag.ScheduledStationClassCodeSequence, rule.getScheduledStationClasses());
        if (!attrs.contains(Tag.ScheduledStationGeographicLocationCodeSequence))
            UPSUtils.setCodes(attrs, Tag.ScheduledStationGeographicLocationCodeSequence, rule.getScheduledStationLocations());
        if (!attrs.contains(Tag.InputReadinessState))
            attrs.setString(Tag.InputReadinessState, VR.CS, rule.getInputReadinessState().toString());
        if (!attrs.contains(Tag.ReferencedRequestSequence)) {
            if (rule.isIncludeReferencedRequest())
                attrs.newSequence(Tag.ReferencedRequestSequence, 1)
                        .add(prevUPSAttrs.getNestedDataset(Tag.ReferencedRequestSequence));
            else
                attrs.setNull(Tag.ReferencedRequestSequence, VR.SQ);
        }
        if (rule.getDestinationAE() != null && !attrs.contains(Tag.OutputDestinationSequence))
            attrs.newSequence(Tag.OutputDestinationSequence, 1)
                    .add(UPSUtils.outputStorage(rule.getDestinationAE()));
        attrs.setString(Tag.ProcedureStepState, VR.CS, "SCHEDULED");
        if (!attrs.contains(Tag.ScheduledProcedureStepPriority))
            attrs.setString(Tag.ScheduledProcedureStepPriority, VR.CS, rule.getUPSPriority().toString());
        if (!attrs.contains(Tag.WorklistLabel))
            attrs.setString(Tag.WorklistLabel, VR.LO, worklistLabel(rule, prevUPSAttrs, upsCtx));
        if (!attrs.contains(Tag.ProcedureStepLabel))
            attrs.setString(Tag.ProcedureStepLabel, VR.LO, rule.getProcedureStepLabel(prevUPSAttrs));
        if (!attrs.contains(Tag.InputInformationSequence))
            updateIncludeInputInformation(attrs, prevUPSAttrs, rule);
        UPSUtils.addScheduledProcessingParameter(attrs, ScopeOfAccumulation.CODE, rule.getScopeOfAccumulation());
        if (rule.isIncludePatient())
            attrs.addAll(prevUPS.getPatient().getAttributes());
        return attrs;
    }

    private Attributes applyXSLT(UPSOnUPSCompleted upsOnUPSCompleted, UPS ups) {
        String uri = upsOnUPSCompleted.getXSLTStylesheetURI();
        if (uri != null) {
            try {
                return SAXTransformer.transform(
                        ups.getAttributes(),
                        TemplatesCache.getDefault().get(StringUtils.replaceSystemProperties(uri)),
                        false,
                        !upsOnUPSCompleted.isNoKeywords(),
                        null);
            } catch (SAXException e) {
                LOG.warn("{}: Failed to apply XSL: {}", ups, uri, e);
            } catch (TransformerConfigurationException e) {
                LOG.warn("{}: Failed to compile XSL: {}", ups, uri, e);
            }
        }
        return new Attributes();
    }

    private String worklistLabel(UPSOnUPSCompleted rule, Attributes prevUPSAttrs, UPSContext ctx) {
        String worklistLabel = rule.getWorklistLabel(prevUPSAttrs);
        return worklistLabel != null ? worklistLabel : ctx.getArchiveAEExtension().upsWorklistLabel();
    }

    private void updateIncludeInputInformation(Attributes attrs, Attributes prevUPSAttrs, UPSOnUPSCompleted rule) {
        if (rule.getIncludeInputInformation() == UPSOnUPSCompleted.IncludeInputInformation.NO)
            return;

        if (rule.getIncludeInputInformation() == UPSOnUPSCompleted.IncludeInputInformation.COPY_INPUT) {
            Sequence prevUPSInputInfoSeq = prevUPSAttrs.getSequence(Tag.InputInformationSequence);
            attrs.newSequence(Tag.InputInformationSequence, prevUPSInputInfoSeq.size())
                    .addAll(prevUPSInputInfoSeq.stream()
                            .map(Attributes::new)
                            .collect(Collectors.toList()));
            return;
        }

        Sequence prevUPSOutputInfoSeq = prevUPSAttrs.getNestedDataset(Tag.UnifiedProcedureStepPerformedProcedureSequence)
                                                    .getSequence(Tag.OutputInformationSequence);
        attrs.newSequence(Tag.InputInformationSequence, prevUPSOutputInfoSeq.size())
                .addAll(prevUPSOutputInfoSeq.stream()
                        .map(Attributes::new)
                        .collect(Collectors.toList()));
    }
}
