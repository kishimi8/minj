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
 * Portions created by the Initial Developer are Copyright (C) 2013-2019
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

package org.dcm4chee.arc.ian.scu.impl;

import org.dcm4che3.conf.api.IApplicationEntityCache;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.net.*;
import org.dcm4che3.net.pdu.AAssociateRQ;
import org.dcm4che3.net.pdu.PresentationContext;
import org.dcm4chee.arc.entity.Task;
import org.dcm4chee.arc.ian.scu.IANSCU;
import org.dcm4chee.arc.qmgt.Outcome;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;
import java.io.IOException;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Apr 2016
 */
@ApplicationScoped
public class IANSCUImpl implements IANSCU {
    private static final Logger LOG = LoggerFactory.getLogger(IANSCUImpl.class);

    @Inject
    private Device device;

    @Inject
    private IApplicationEntityCache aeCache;

    @Override
    public Outcome sendIAN(String localAET, String remoteAET, String sopInstanceUID, Attributes attrs)
            throws Exception {
        ApplicationEntity localAE = device.getApplicationEntity(localAET, true);
        ApplicationEntity remoteAE = aeCache.findApplicationEntity(remoteAET);
        AAssociateRQ aarq = mkAAssociateRQ(localAE);
        Association as = localAE.connect(remoteAE, aarq);
        try {
            DimseRSP rsp = as.ncreate(UID.InstanceAvailabilityNotification, sopInstanceUID, attrs, null);
            rsp.next();
            int status = rsp.getCommand().getInt(Tag.Status, -1);
            return status == Status.Success
                    ? new Outcome(Task.Status.COMPLETED,
                    "Send IAN[uid=" + sopInstanceUID + "] to AE: " + remoteAET)
                    : new Outcome(Task.Status.WARNING,
                    "Send IAN[uid=" + sopInstanceUID + "] to AE: " + remoteAET
                            + " failed with error status: " + Integer.toHexString(status) + 'H');
        } finally {
            try {
                as.release();
            } catch (IOException e) {
                LOG.info("{}: Failed to release association to {}", as, remoteAET);
            }
        }
    }

    @Override
    public DimseRSP sendIANRQ(String localAET, String remoteAET, String sopInstanceUID, Attributes ian)
            throws Exception {
        return sendIANRQ(device.getApplicationEntity(localAET, true),
                aeCache.findApplicationEntity(remoteAET),
                sopInstanceUID,
                ian);
    }

    @Override
    public DimseRSP sendIANRQ(ApplicationEntity localAE, ApplicationEntity remoteAE, String sopInstanceUID, Attributes ian)
            throws Exception {
        AAssociateRQ aarq = mkAAssociateRQ(localAE);
        Association as = localAE.connect(remoteAE, aarq);
        try {
            return as.ncreate(UID.InstanceAvailabilityNotification, sopInstanceUID, ian, null);
        } finally {
            try {
                as.release();
            } catch (IOException e) {
                LOG.info("{}: Failed to release association to {}", as, remoteAE.getAETitle());
            }
        }
    }

    private AAssociateRQ mkAAssociateRQ(ApplicationEntity localAE) {
        AAssociateRQ aarq = new AAssociateRQ();
        TransferCapability tc = localAE.getTransferCapabilityFor(UID.InstanceAvailabilityNotification,
                TransferCapability.Role.SCU);
        if (tc == null)
            LOG.warn("No Transfer ServiceClass for Instance Availability Notification SOP Class as SCU configured for {}",
                    localAE.getAETitle());
        aarq.addPresentationContext(new PresentationContext(1, UID.InstanceAvailabilityNotification,
                tc != null ? tc.getTransferSyntaxes() : new String[] { UID.ImplicitVRLittleEndian }));
        return aarq;
    }
}
