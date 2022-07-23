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

package org.dcm4chee.arc.rs.util;

import org.dcm4che3.data.UID;
import org.dcm4che3.util.StringUtils;
import org.jboss.resteasy.util.MediaTypeHelper;

import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * @author Gunter Zeilinger (gunterze@protonmail.com)
 * @since Oct 2019
 */

public class MediaTypeUtils {

    public static List<MediaType> acceptableMediaTypesOf(HttpHeaders headers, List<String> acceptQueryParam) {
        if (acceptQueryParam.isEmpty()) {
            return headers.getAcceptableMediaTypes();
        }
        List<MediaType> list = acceptQueryParam.stream()
                .flatMap(s -> Stream.of(StringUtils.split(s, ',')))
                .map(String::trim)
                .map(MediaType::valueOf)
                .collect(Collectors.toList());
        MediaTypeHelper.sortByWeight(list);
        return list;
    }

    public static String selectTransferSyntax(Collection<String> acceptable, String tsuid) {
        return acceptable.isEmpty() || acceptable.contains(tsuid)
                ? tsuid
                : acceptable.contains(UID.ExplicitVRLittleEndian)
                ? UID.ExplicitVRLittleEndian
                : UID.ImplicitVRLittleEndian;
    }
}
