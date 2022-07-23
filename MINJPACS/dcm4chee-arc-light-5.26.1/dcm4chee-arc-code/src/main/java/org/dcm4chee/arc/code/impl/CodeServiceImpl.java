/*
 * ** BEGIN LICENSE BLOCK *****
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
 * Portions created by the Initial Developer are Copyright (C) 2016
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
 * ** END LICENSE BLOCK *****
 */

package org.dcm4chee.arc.code.impl;

import org.dcm4che3.data.Code;
import org.dcm4che3.net.Device;
import org.dcm4che3.net.service.DicomServiceException;
import org.dcm4chee.arc.code.CodeService;
import org.dcm4chee.arc.conf.ArchiveDeviceExtension;
import org.dcm4chee.arc.entity.CodeEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ejb.EJBException;
import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Oct 2016
 */
@ApplicationScoped
public class CodeServiceImpl implements CodeService {

    static final Logger LOG = LoggerFactory.getLogger(CodeServiceImpl.class);

    @Inject
    private CodeServiceEJB ejb;

    @Inject
    private Device device;

    @Override
    public CodeEntity findOrCreate(Code code) {
        ArchiveDeviceExtension arcDev = device.getDeviceExtension(ArchiveDeviceExtension.class);
        int retries = arcDev.getStoreUpdateDBMaxRetries();
        for (;;) {
            try {
                return ejb.findOrCreate(code);
            } catch (EJBException e) {
                if (retries-- > 0) {
                    LOG.info("Failed to update DB caused by {} - retry",
                            DicomServiceException.initialCauseOf(e).toString());
                    LOG.debug("Failed to update DB - retry:\n", e);
                } else {
                    LOG.warn("Failed to update DB:\n", e);
                    throw e;
                }
            }
            try {
                Thread.sleep(arcDev.storeUpdateDBRetryDelay());
            } catch (InterruptedException e) {
                LOG.info("Failed to delay retry to update DB:\n", e);
            }
        }
    }
}
