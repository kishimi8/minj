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
 * Portions created by the Initial Developer are Copyright (C) 2013
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

package org.dcm4chee.arc.procedure.scp;

import org.dcm4che3.data.*;
import org.dcm4che3.net.Association;
import org.dcm4che3.net.QueryOption;
import org.dcm4che3.net.Status;
import org.dcm4che3.net.pdu.PresentationContext;
import org.dcm4che3.net.service.BasicCFindSCP;
import org.dcm4che3.net.service.DicomService;
import org.dcm4che3.net.service.DicomServiceException;
import org.dcm4che3.net.service.QueryTask;
import org.dcm4chee.arc.query.QueryContext;
import org.dcm4chee.arc.query.QueryService;
import org.dcm4chee.arc.query.RunInTransaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ejb.EJB;
import javax.enterprise.context.ApplicationScoped;
import javax.enterprise.inject.Typed;
import javax.inject.Inject;
import java.util.EnumSet;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Jun 2016
 */
@ApplicationScoped
@Typed(DicomService.class)
public class MWLCFindSCP extends BasicCFindSCP {

    private static final Logger LOG = LoggerFactory.getLogger(MWLCFindSCP.class);

    @Inject
    private QueryService queryService;

    @EJB
    private RunInTransaction runInTx;

    public MWLCFindSCP() {
        super(UID.ModalityWorklistInformationModelFind);
    }

    @Override
    protected QueryTask calculateMatches(Association as, PresentationContext pc, Attributes rq, Attributes keys) throws DicomServiceException {
        LOG.info("{}: Process MWL C-FIND RQ:\n{}", as, keys);
        String sopClassUID = rq.getString(Tag.AffectedSOPClassUID);
        EnumSet<QueryOption> queryOpts = as.getQueryOptionsFor(sopClassUID);
        QueryContext ctx = queryService.newQueryContextFIND(as, sopClassUID, queryOpts);
        ctx.setQueryKeys(keys);
        ctx.setReturnKeys(createReturnKeys(keys));
        try {
            queryService.coerceAttributes(ctx);
        } catch (DicomServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new DicomServiceException(Status.ProcessingFailure, e);
        }
        IDWithIssuer idWithIssuer = IDWithIssuer.pidOf(keys);
        if (idWithIssuer != null && !idWithIssuer.getID().equals("*"))
            ctx.setPatientIDs(idWithIssuer);
        else if (ctx.getArchiveAEExtension().filterByIssuerOfPatientID())
            ctx.setIssuerOfPatientID(Issuer.fromIssuerOfPatientID(keys));
        return new MWLQueryTask(as, pc, rq, keys,
                queryService.createMWLQuery(ctx),
                queryService.getAttributesCoercion(ctx),
                runInTx);
    }

    private Attributes createReturnKeys(Attributes keys) {
        Attributes returnKeys = new Attributes(keys.size() + 3);
        returnKeys.addAll(keys);
        returnKeys.setNull(Tag.SpecificCharacterSet, VR.CS);
        return returnKeys;
    }
}
