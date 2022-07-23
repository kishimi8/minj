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

package org.dcm4chee.arc.retrieve.impl;

import org.dcm4chee.arc.entity.Completeness;
import org.dcm4chee.arc.retrieve.StudyInfo;

import java.util.Date;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Feb 2016
 */
public class StudyInfoImpl implements StudyInfo {
    private final Long studyPk;
    private final String studyInstanceUID;
    private final Date accessTime;
    private final int failedRetrieves;
    private final Completeness completeness;
    private final Date modifiedTime;
    private final String expirationDate;
    private final String accessControlID;
    private volatile long studySize;

    public StudyInfoImpl(long studyPk, String studyInstanceUID, Date accessTime, int failedRetrieves,
                         Completeness completeness, Date modifiedTime, String expirationDate, String accessControlID,
                         long studySize) {
        this.studyPk = studyPk;
        this.studyInstanceUID = studyInstanceUID;
        this.accessTime = accessTime;
        this.failedRetrieves = failedRetrieves;
        this.completeness = completeness;
        this.modifiedTime = modifiedTime;
        this.expirationDate = expirationDate;
        this.accessControlID = accessControlID;
        this.studySize = studySize;
    }

    @Override
    public Long getStudyPk() {
        return studyPk;
    }

    @Override
    public String getStudyInstanceUID() {
        return studyInstanceUID;
    }

    @Override
    public Date getAccessTime() {
        return accessTime;
    }

    @Override
    public int getFailedRetrieves() {
        return failedRetrieves;
    }

    @Override
    public Completeness getCompleteness() {
        return completeness;
    }

    @Override
    public Date getModifiedTime() {
        return modifiedTime;
    }

    @Override
    public String getExpirationDate() {
        return expirationDate;
    }

    @Override
    public String getAccessControlID() {
        return accessControlID;
    }

    @Override
    public long getStudySize() {
        return studySize;
    }

    @Override
    public void setStudySize(long studySize) {
        this.studySize = studySize;
    }
}
