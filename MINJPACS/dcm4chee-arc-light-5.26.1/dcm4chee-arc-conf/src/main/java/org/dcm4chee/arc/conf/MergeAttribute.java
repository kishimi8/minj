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

package org.dcm4chee.arc.conf;

import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.ElementDictionary;
import org.dcm4che3.data.Sequence;
import org.dcm4che3.data.Tag;
import org.dcm4che3.util.AttributesFormat;
import org.dcm4che3.util.TagUtils;

import java.util.stream.Stream;

/**
 * @author Gunter Zeilinger (gunterze@protonmail.com)
 * @since Oct 2019
 */
public class MergeAttribute {
    private static final ElementDictionary dict = ElementDictionary.getStandardElementDictionary();
    final String value;
    final int[] tagPath;
    final AttributesFormat format;

    public MergeAttribute(String value) {
        try {
            this.value = value;
            int index = value.indexOf('=');
            tagPath = TagUtils.parseTagPath(value.substring(0, index));
            int beginIndex = index + 1;
            format = beginIndex <  value.length() ? new AttributesFormat(value.substring(beginIndex)) : null;
        } catch (Exception e) {
            throw new IllegalArgumentException(value);
        }
    }

    @Override
    public String toString() {
        return value;
    }

    static MergeAttribute[] of(String... ss) {
        return Stream.of(ss)
                .map(MergeAttribute::new)
                .toArray(MergeAttribute[]::new);
    }

    public void merge(Attributes attrs, Attributes modified) {
        int tag = tagPath[tagPath.length - 1];
        String oldValue;
        if (format != null) {
            Attributes item = ensureItem(attrs);
            oldValue = item.getString(tag);
            String newValue = format.format(attrs);
            if (newValue.equals(oldValue)) return;
            if (tag == Tag.SpecificCharacterSet) {
                item.setSpecificCharacterSet(newValue);
                return;
            }
            item.setString(tag, dict.vrOf(tag), newValue);
        } else {
            Attributes item = getItem(attrs);
            if (item == null || (oldValue = item.getString(tag)) == null) return;
            item.setNull(tag, dict.vrOf(tag));
        }
        if (modified != null && oldValue != null) {
            ensureItem(modified).setString(tag, dict.vrOf(tag), oldValue);
        }
    }

    private static Attributes ensureItem(Attributes attrs, int tag) {
        Sequence sq = attrs.ensureSequence(tag, 1);
        Attributes item;
        if (sq.isEmpty()) {
            sq.add(item = new Attributes());
        } else {
            item = sq.get(0);
        }
        return item;
    }

    private Attributes ensureItem(Attributes attrs) {
        Attributes item = attrs;
        int last = tagPath.length - 1;
        for (int i = 0; i < last; i++) {
            item = ensureItem(item, tagPath[i]);
        }
        return item;
    }

    private Attributes getItem(Attributes attrs) {
        Attributes item = attrs;
        int last = tagPath.length - 1;
        for (int i = 0; i < last; i++) {
            item = item.getNestedDataset(tagPath[i]);
        }
        return item;
    }
}
