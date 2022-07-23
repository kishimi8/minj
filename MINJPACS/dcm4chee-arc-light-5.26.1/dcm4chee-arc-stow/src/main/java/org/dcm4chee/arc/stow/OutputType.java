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

package org.dcm4chee.arc.stow;

import org.dcm4che3.data.Attributes;
import org.dcm4che3.io.SAXTransformer;
import org.dcm4che3.json.JSONWriter;
import org.dcm4che3.net.ApplicationEntity;
import org.dcm4chee.arc.conf.ArchiveAEExtension;

import javax.json.Json;
import javax.json.stream.JsonGenerator;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.StreamingOutput;
import javax.xml.transform.stream.StreamResult;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Aug 2019
 */
enum OutputType {
    DICOM_XML {
        @Override
        StreamingOutput entity(final Attributes response, ApplicationEntity ae) {
            return out -> {
                try {
                    SAXTransformer.getSAXWriter(new StreamResult(out)).write(response);
                } catch (Exception e) {
                    throw new WebApplicationException(e);
                }
            };
        }
    },
    JSON {
        @Override
        StreamingOutput entity(final Attributes response, ApplicationEntity ae) {
            return out -> {
                JsonGenerator gen = Json.createGenerator(out);
                ae.getAEExtensionNotNull(ArchiveAEExtension.class)
                        .encodeAsJSONNumber(new JSONWriter(gen))
                        .write(response);
                gen.flush();
            };
        }
    };

    abstract StreamingOutput entity(Attributes response, ApplicationEntity ae);
}
