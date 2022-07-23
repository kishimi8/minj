package org.dcm4chee.arc.iocm.rs;

import org.dcm4che3.data.*;
import org.dcm4che3.net.ApplicationEntity;
import org.dcm4chee.arc.conf.AcceptConflictingPatientID;
import org.dcm4chee.arc.conf.ArchiveAEExtension;
import org.dcm4chee.arc.conf.RejectionNote;
import org.dcm4chee.arc.procedure.ProcedureContext;
import org.dcm4chee.arc.procedure.ProcedureService;
import org.dcm4chee.arc.query.QueryService;
import org.dcm4chee.arc.retrieve.RetrieveService;
import org.dcm4chee.arc.store.InstanceLocations;
import org.dcm4chee.arc.store.StoreContext;
import org.dcm4chee.arc.store.StoreService;
import org.dcm4chee.arc.store.StoreSession;

import javax.json.Json;
import javax.json.stream.JsonParser;
import javax.json.stream.JsonParsingException;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

class IocmUtils {

    static Attributes linkInstancesWithMWL(
            StoreSession session, RetrieveService retrieveService, ProcedureService procedureService,
            ProcedureContext ctx, QueryService queryService, RejectionNote rjNote, Attributes coerceAttrs, InputStream in)
            throws Exception{
        final Attributes result;
        String studyInstanceUID = ctx.getStudyInstanceUID();
        ArchiveAEExtension arcAE = session.getArchiveAEExtension();
        StoreService storeService = session.getStoreService();

        Attributes instanceRefs = parseSOPInstanceReferences(in);
        ctx.setSourceInstanceRefs(instanceRefs);
        restoreInstances(session, instanceRefs);
        Collection<InstanceLocations> instanceLocations = retrieveService.queryInstances(
                                                            session, instanceRefs, studyInstanceUID);
        if (instanceLocations.isEmpty())
            return null;

        if (studyInstanceUID.equals(instanceRefs.getString(Tag.StudyInstanceUID))) {
            procedureService.updateStudySeriesAttributes(ctx);
            result = getResult(instanceLocations);
        } else {
            Attributes sopInstanceRefs = getSOPInstanceRefs(instanceRefs, instanceLocations, arcAE.getApplicationEntity());
            moveSequence(sopInstanceRefs, Tag.ReferencedSeriesSequence, instanceRefs);
            session.setAcceptConflictingPatientID(AcceptConflictingPatientID.YES);
            session.setPatientUpdatePolicy(Attributes.UpdatePolicy.PRESERVE);
            session.setStudyUpdatePolicy(arcAE.linkMWLEntryUpdatePolicy());
            result = storeService.copyInstances(
                    session, instanceLocations, coerceAttrs, Attributes.UpdatePolicy.OVERWRITE);
            rejectInstances(instanceRefs, queryService, rjNote, session, result);
        }
        return result;
    }

    static Attributes copyMove(
            StoreSession session, RetrieveService retrieveService, QueryService queryService, String studyInstanceUID,
            Attributes coerceAttrs, RejectionNote rjNote, InputStream in)
            throws Exception {
        ArchiveAEExtension arcAE = session.getArchiveAEExtension();
        StoreService storeService = session.getStoreService();
        Attributes instanceRefs = parseSOPInstanceReferences(in);
        restoreInstances(session, instanceRefs);
        Collection<InstanceLocations> instanceLocations = retrieveService.queryInstances(
                session, instanceRefs, studyInstanceUID);
        if (instanceLocations.isEmpty())
            return null;

        Attributes sopInstanceRefs = getSOPInstanceRefs(instanceRefs, instanceLocations, arcAE.getApplicationEntity());
        moveSequence(sopInstanceRefs, Tag.ReferencedSeriesSequence, instanceRefs);
        session.setAcceptConflictingPatientID(AcceptConflictingPatientID.YES);
        session.setPatientUpdatePolicy(Attributes.UpdatePolicy.PRESERVE);
        session.setStudyUpdatePolicy(arcAE.copyMoveUpdatePolicy());
        Attributes result = storeService.copyInstances(
                                        session, instanceLocations, coerceAttrs, Attributes.UpdatePolicy.MERGE);
        if (rjNote != null)
            rejectInstances(instanceRefs, queryService, rjNote, session, result);
        return result;
    }

    static void rejectInstances(
            Attributes instanceRefs, QueryService queryService, RejectionNote rjNote, StoreSession session,
            Attributes result)
            throws IOException {
        Sequence refSeriesSeq = instanceRefs.getSequence(Tag.ReferencedSeriesSequence);
        removeFailedInstanceRefs(refSeriesSeq, failedIUIDs(result));
        if (!refSeriesSeq.isEmpty())
            reject(session, queryService, instanceRefs, rjNote);
    }

    private static Set<String> failedIUIDs(Attributes result) {
        Sequence failedSOPSeq = result.getSequence(Tag.FailedSOPSequence);
        if (failedSOPSeq == null || failedSOPSeq.isEmpty())
            return Collections.emptySet();

        Set<String> failedIUIDs = new HashSet<>(failedSOPSeq.size() * 4 / 3 + 1);
        failedSOPSeq.forEach(failedSOPRef -> failedIUIDs.add(failedSOPRef.getString(Tag.ReferencedSOPInstanceUID)));
        return failedIUIDs;
    }

    private static void removeFailedInstanceRefs(Sequence refSeriesSeq, Set<String> failedIUIDs) {
        if (failedIUIDs.isEmpty())
            return;

        for (Iterator<Attributes> refSeriesIter = refSeriesSeq.iterator(); refSeriesIter.hasNext();) {
            Sequence refSOPSeq = refSeriesIter.next().getSequence(Tag.ReferencedSOPSequence);
            refSOPSeq.removeIf(attributes -> failedIUIDs.contains(attributes.getString(Tag.ReferencedSOPInstanceUID)));
            if (refSOPSeq.isEmpty())
                refSeriesIter.remove();
        }
    }

    private static void reject(
            StoreSession session, QueryService queryService, Attributes instanceRefs, RejectionNote rjNote)
            throws IOException {
        StoreService storeService = session.getStoreService();
        StoreContext koctx = storeService.newStoreContext(session);
        Attributes ko = queryService.createRejectionNote(instanceRefs, rjNote);
        koctx.setReceiveTransferSyntax(UID.ExplicitVRLittleEndian);
        storeService.store(koctx, ko);
    }

    private static Attributes getResult(Collection<InstanceLocations> instanceLocations) {
        Attributes result = new Attributes();
        Sequence refSOPSeq = result.newSequence(Tag.ReferencedSOPSequence, instanceLocations.size());
        instanceLocations.forEach(instanceLocation -> populateResult(refSOPSeq, instanceLocation));
        return result;
    }

    private static void populateResult(Sequence refSOPSeq, InstanceLocations instanceLocation) {
        Attributes refSOP = new Attributes(2);
        refSOP.setString(Tag.ReferencedSOPClassUID, VR.UI, instanceLocation.getSopClassUID());
        refSOP.setString(Tag.ReferencedSOPInstanceUID, VR.UI, instanceLocation.getSopInstanceUID());
        refSOPSeq.add(refSOP);
    }

    private static Attributes getSOPInstanceRefs(Attributes instanceRefs, Collection<InstanceLocations> instances,
                                          ApplicationEntity ae) {
        String sourceStudyUID = instanceRefs.getString(Tag.StudyInstanceUID);
        Attributes refStudy = new Attributes(2);
        Sequence refSeriesSeq = refStudy.newSequence(Tag.ReferencedSeriesSequence, 10);
        refStudy.setString(Tag.StudyInstanceUID, VR.UI, sourceStudyUID);
        HashMap<String, Sequence> seriesMap = new HashMap<>();
        instances.forEach(instance -> {
            Attributes iAttr = instance.getAttributes();
            String seriesIUID = iAttr.getString(Tag.SeriesInstanceUID);
            Sequence refSOPSeq = seriesMap.get(seriesIUID);
            if (refSOPSeq == null) {
                Attributes refSeries = new Attributes(4);
                refSeries.setString(Tag.RetrieveAETitle, VR.AE, ae.getAETitle());
                refSOPSeq = refSeries.newSequence(Tag.ReferencedSOPSequence, 10);
                refSeries.setString(Tag.SeriesInstanceUID, VR.UI, seriesIUID);
                seriesMap.put(seriesIUID, refSOPSeq);
                refSeriesSeq.add(refSeries);
            }
            Attributes refSOP = new Attributes(2);
            refSOP.setString(Tag.ReferencedSOPClassUID, VR.UI, instance.getSopClassUID());
            refSOP.setString(Tag.ReferencedSOPInstanceUID, VR.UI, instance.getSopInstanceUID());
            refSOPSeq.add(refSOP);
        });
        return refStudy;
    }

    private static void moveSequence(Attributes src, int tag, Attributes dest) {
        Sequence srcSeq = src.getSequence(tag);
        int size = srcSeq.size();
        Sequence destSeq = dest.newSequence(tag, size);
        for (int i = 0; i < size; i++)
            destSeq.add(srcSeq.remove(0));
    }

    private static void restoreInstances(StoreSession session, Attributes sopInstanceRefs) throws IOException {
        StoreService storeService = session.getStoreService();
        String studyUID = sopInstanceRefs.getString(Tag.StudyInstanceUID);
        Sequence seq = sopInstanceRefs.getSequence(Tag.ReferencedSeriesSequence);
        if (seq == null || seq.isEmpty())
            storeService.restoreInstances(session, studyUID, null, null);
        else for (Attributes item : seq)
            storeService.restoreInstances(session, studyUID, item.getString(Tag.SeriesInstanceUID), null);
    }

    private static Attributes parseSOPInstanceReferences(InputStream in) {
        Attributes attrs = new Attributes(2);
        try {
            JsonParser parser = Json.createParser(new InputStreamReader(in, StandardCharsets.UTF_8));
            expect(parser, JsonParser.Event.START_OBJECT);
            while (parser.next() == JsonParser.Event.KEY_NAME) {
                String keyName = parser.getString();
                switch (keyName) {
                    case "StudyInstanceUID":
                        expect(parser, JsonParser.Event.VALUE_STRING);
                        attrs.setString(Tag.StudyInstanceUID, VR.UI, parser.getString());
                        break;
                    case "ReferencedSeriesSequence":
                        parseReferencedSeriesSequence(parser,
                                attrs.newSequence(Tag.ReferencedSeriesSequence, 10));
                        break;
                    default:
                        throw new IllegalArgumentException("Unexpected Key name " + keyName);
                }
            }
        } catch (JsonParsingException e) {
            throw new IllegalArgumentException(e.getMessage() + " at location : " + e.getLocation());
        }

        if (!attrs.contains(Tag.StudyInstanceUID))
            throw new IllegalArgumentException("Missing StudyInstanceUID");

        return attrs;
    }

    private static void parseReferencedSeriesSequence(JsonParser parser, Sequence seq) {
        expect(parser, JsonParser.Event.START_ARRAY);
        while (parser.next() == JsonParser.Event.START_OBJECT)
            seq.add(parseReferencedSeries(parser));
    }

    private static Attributes parseReferencedSeries(JsonParser parser) {
        Attributes attrs = new Attributes(2);
        while (parser.next() == JsonParser.Event.KEY_NAME) {
            String keyName = parser.getString();
            switch (keyName) {
                case "SeriesInstanceUID":
                    expect(parser, JsonParser.Event.VALUE_STRING);
                    attrs.setString(Tag.SeriesInstanceUID, VR.UI, parser.getString());
                    break;
                case "ReferencedSOPSequence":
                    parseReferencedSOPSequence(parser,
                            attrs.newSequence(Tag.ReferencedSOPSequence, 10));
                    break;
                default:
                    throw new IllegalArgumentException("Unexpected Key name " + keyName);
            }
        }

        if (!attrs.contains(Tag.SeriesInstanceUID))
            throw new IllegalArgumentException("Missing SeriesInstanceUID");

        return attrs;
    }

    private static void parseReferencedSOPSequence(JsonParser parser, Sequence seq) {
        expect(parser, JsonParser.Event.START_ARRAY);
        while (parser.next() == JsonParser.Event.START_OBJECT)
            seq.add(parseReferencedSOP(parser));
    }

    private static Attributes parseReferencedSOP(JsonParser parser) {
        Attributes attrs = new Attributes(2);
        while (parser.next() == JsonParser.Event.KEY_NAME) {
            String keyName = parser.getString();
            switch (keyName) {
                case "ReferencedSOPClassUID":
                    expect(parser, JsonParser.Event.VALUE_STRING);
                    attrs.setString(Tag.ReferencedSOPClassUID, VR.UI, parser.getString());
                    break;
                case "ReferencedSOPInstanceUID":
                    expect(parser, JsonParser.Event.VALUE_STRING);
                    attrs.setString(Tag.ReferencedSOPInstanceUID, VR.UI, parser.getString());
                    break;
                default:
                    throw new IllegalArgumentException("Unexpected Key name " + keyName);
            }
        }

        if (!attrs.contains(Tag.ReferencedSOPClassUID))
            throw new IllegalArgumentException("Missing ReferencedSOPClassUID");

        if (!attrs.contains(Tag.ReferencedSOPInstanceUID))
            throw new IllegalArgumentException("Missing ReferencedSOPInstanceUID");

        return attrs;
    }

    private static void expect(JsonParser parser, JsonParser.Event expected) {
        JsonParser.Event next = parser.next();
        if (next != expected)
            throw new IllegalArgumentException("Unexpected " + next);
    }
}
