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
 * Portions created by the Initial Developer are Copyright (C) 2015
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

package org.dcm4chee.arc.entity;

import org.dcm4che3.data.PersonName.Component;

import javax.persistence.*;
import java.util.Iterator;
import java.util.StringTokenizer;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 *
 */
@Entity
@Table(name = "soundex_code", indexes = {
    @Index(columnList = "sx_pn_comp"),
    @Index(columnList = "sx_pn_comp_part"),
    @Index(columnList = "sx_code_value")
})
public class SoundexCode {

    @Id
    @GeneratedValue(strategy=GenerationType.IDENTITY)
    @Column(name = "pk")
    private long pk;

    @Column(name = "sx_pn_comp", nullable = false)
    private Component personNameComponent;

    @Column(name = "sx_pn_comp_part", nullable = false)
    private int componentPartIndex;

    @Column(name = "sx_code_value", nullable = false)
    private String codeValue;

    @ManyToOne(optional = false)
    @JoinColumn(name = "person_name_fk")
    private PersonName personName;

    public SoundexCode() {}

    public SoundexCode(Component personNameComponent, int componentPartIndex,
                       String codeValue) {
        this.personNameComponent = personNameComponent;
        this.componentPartIndex = componentPartIndex;
        this.codeValue = codeValue.isEmpty() ? "*" : codeValue;
    }

    public static Iterator<String> tokenizePersonNameComponent(String name) {
        final StringTokenizer stk = new StringTokenizer(name, " ,-\t");
        return new Iterator<String>() {

            @Override
            public boolean hasNext() {
                return stk.hasMoreTokens();
            }

            @Override
            public String next() {
                return stk.nextToken();
            }

            @Override
            public void remove() {
                throw new UnsupportedOperationException();
            }};
    }

    public long getPk() {
        return pk;
    }

    public Component getPersonNameComponent() {
        return personNameComponent;
    }

    public int getComponentPartIndex() {
        return componentPartIndex;
    }

    public String getCodeValue() {
        return codeValue.equals("*") ? "" : codeValue;
    }

    public PersonName getPersonName() {
        return personName;
    }

    public void setPersonName(PersonName personName) {
        this.personName = personName;
    }

}
