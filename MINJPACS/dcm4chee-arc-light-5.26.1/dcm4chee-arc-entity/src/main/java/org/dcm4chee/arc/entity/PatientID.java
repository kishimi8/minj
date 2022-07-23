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

import org.dcm4che3.data.IDWithIssuer;
import org.dcm4che3.data.Issuer;

import javax.persistence.*;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 *
 */
@Entity
@Table(name = "patient_id",
        indexes = {
                @Index(columnList = "pat_id"),
                @Index(columnList = "entity_id"),
                @Index(columnList = "entity_uid, entity_uid_type")
        })
public class PatientID {

    @Id
    @GeneratedValue(strategy=GenerationType.IDENTITY)
    @Column(name = "pk")
    private long pk;
    
    @Version
    @Column(name = "version")
    private long version;    

    @Basic(optional=false)
    @Column(name = "pat_id")
    private String id;

    @Column(name = "entity_id")
    private String localNamespaceEntityID;

    @Column(name = "entity_uid")
    private String universalEntityID;

    @Column(name = "entity_uid_type")
    private String universalEntityIDType;

    @Column(name = "pat_id_type_code")
    private String identifierTypeCode;

    public long getPk() {
        return pk;
    }

    public String getID() {
        return id;
    }

    public void setID(String id) {
        this.id = id;
    }

    public Issuer getIssuer() {
        return localNamespaceEntityID != null || universalEntityID != null
                ? new Issuer(localNamespaceEntityID, universalEntityID, universalEntityIDType)
                : null;
    }

    public void setIssuer(Issuer issuer) {
        if (issuer != null) {
            localNamespaceEntityID = issuer.getLocalNamespaceEntityID();
            universalEntityID = issuer.getUniversalEntityID();
            universalEntityIDType = issuer.getUniversalEntityIDType();
        } else {
            localNamespaceEntityID = null;
            universalEntityID = null;
            universalEntityIDType = null;
        }
    }

    public String getIdentifierTypeCode() {
        return identifierTypeCode;
    }

    public void setIdentifierTypeCode(String identifierTypeCode) {
        this.identifierTypeCode = identifierTypeCode;
    }

    public IDWithIssuer getIDWithIssuer() {
        return new IDWithIssuer(id, getIssuer());
    }

    @Override
    public String toString() {
        return "PatientID[pk=" + pk
                + ", id=" + id
                + ", issuer=" + getIssuer()
                + "]";
    }
}
