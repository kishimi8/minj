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

package org.dcm4chee.arc.conf;

import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.VR;
import org.junit.Test;

import static org.junit.Assert.*;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Jun 2016
 */
public class ConditionsTest {
    @Test
    public void match() throws Exception {
        Attributes empty = new Attributes();
        Conditions hostname = new Conditions("SendingHostname=storescu");
        assertTrue(hostname.match("storescu", null, null, null, empty));
        assertFalse(hostname.match("dcmqrscp", null, null, null, empty));
        assertFalse(hostname.match("dcmqrscp", null, null, null, empty));
        Conditions nothostname = new Conditions("SendingHostname!=storescu");
        assertFalse(nothostname.match("storescu", null, null, null, empty));
        assertTrue(nothostname.match("dcmqrscp", null, null, null, empty));
        assertTrue(nothostname.match(null, null, null, null, empty));
        Conditions sending = new Conditions("SendingApplicationEntityTitle=STORESCU");
        assertTrue(sending.match(null, "STORESCU", null, null, empty));
        assertFalse(sending.match(null, "DCMQRSCP", null, null, empty));
        assertFalse(sending.match(null, null, null, null, empty));
        Conditions notsending = new Conditions("SendingApplicationEntityTitle!=STORESCU");
        assertFalse(notsending.match(null, "STORESCU", null, null, empty));
        assertTrue(notsending.match(null, "DCMQRSCP", null, null, empty));
        assertTrue(notsending.match(null, null, null, null, empty));
        Conditions receiving = new Conditions("ReceivingApplicationEntityTitle=DCM4CHEE");
        assertTrue(receiving.match(null, null, null, "DCM4CHEE", empty));
        assertFalse(receiving.match(null, null, null, "DCMQRSCP", empty));
        assertFalse(receiving.match(null, null, null, null, empty));
        Conditions notreceiving = new Conditions("ReceivingApplicationEntityTitle!=DCM4CHEE");
        assertFalse(notreceiving.match(null, null, null, "DCM4CHEE", empty));
        assertTrue(notreceiving.match(null, null, null, "DCMQRSCP", empty));
        assertTrue(notreceiving.match(null, null, null, null, empty));
        Attributes ct = modality("CT");
        Attributes mr = modality("MR");
        Attributes emptyModality = modality(null);
        Conditions modality = new Conditions("Modality=CT");
        assertTrue(modality.match(null, null, null, null, ct));
        assertFalse(modality.match(null, null, null, null, mr));
        assertFalse(modality.match(null, null, null, null, emptyModality));
        assertFalse(modality.match(null, null, null, null, empty));
        Conditions notmodality = new Conditions("Modality!=CT");
        assertFalse(notmodality.match(null, null, null, null, ct));
        assertTrue(notmodality.match(null, null, null, null, mr));
        assertTrue(notmodality.match(null, null, null, null, emptyModality));
        assertTrue(notmodality.match(null, null, null, null, empty));
        Conditions nomodality = new Conditions("Modality!=.+");
        assertFalse(nomodality.match(null, null, null, null, ct));
        assertFalse(nomodality.match(null, null, null, null, mr));
        assertTrue(nomodality.match(null, null, null, null, emptyModality));
        assertTrue(nomodality.match(null, null, null, null, empty));
        Attributes spsItemCT = spsItem(ct);
        Attributes spsItemMR = spsItem(mr);
        Attributes spsItemEmpty = spsItem(empty);
        Conditions spsItem = new Conditions("00400100.Modality=CT");
        assertTrue(spsItem.match(null, null, null, null, spsItemCT));
        assertFalse(spsItem.match(null, null, null, null, spsItemMR));
        assertFalse(spsItem.match(null, null, null, null, spsItemEmpty));
        assertFalse(spsItem.match(null, null, null, null, empty));
        Conditions notSpsItem = new Conditions("00400100.Modality!=CT");
        assertFalse(notSpsItem.match(null, null, null, null, spsItemCT));
        assertTrue(notSpsItem.match(null, null, null, null, spsItemMR));
        assertTrue(notSpsItem.match(null, null, null, null, spsItemEmpty));
        assertTrue(notSpsItem.match(null, null, null, null, empty));
    }

    private Attributes modality(String modality) {
        Attributes attrs = new Attributes(1);
        attrs.setString(Tag.Modality, VR.CS, modality);
        return attrs;
    }

    private Attributes spsItem(Attributes item) {
        Attributes attrs = new Attributes(1);
        attrs.newSequence(Tag.ScheduledProcedureStepSequence, 1).add(item);
        return attrs;
    }
}