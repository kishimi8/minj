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
 * Portions created by the Initial Developer are Copyright (C) 2015-2018
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

import org.dcm4che3.data.IDWithIssuer;
import org.dcm4che3.data.Issuer;

import java.util.Arrays;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Nov 2018
 */
public class HL7PrefetchRule {

    public static final HL7PrefetchRule[] EMPTY = {};
    private String commonName;

    private String queueName;

    private String aeTitle;

    private String prefetchCFindSCP;

    private String prefetchCMoveSCP;

    private String[] prefetchCStoreSCPs = {};

    private String destinationCFindSCP;

    private String prefetchDeviceName;

    private HL7Conditions conditions = new HL7Conditions();

    private Duration suppressDuplicateRetrieveInterval;

    private int suppressDuplicateHistorySize = 100;

    private String prefetchDateTimeField;

    private Duration prefetchInAdvance;

    private NullifyIssuer ignoreAssigningAuthorityOfPatientID;

    private Issuer[] assigningAuthorityOfPatientIDs = {};

    private Issuer prefetchForAssigningAuthorityOfPatientID;

    private EntitySelector[] entitySelectors = {};

    private ScheduleExpression[] schedules = {};

    public HL7PrefetchRule() {
    }

    public HL7PrefetchRule(String commonName) {
        setCommonName(commonName);
    }

    public String getCommonName() {
        return commonName;
    }

    public void setCommonName(String commonName) {
        this.commonName = commonName;
    }

    public String getQueueName() {
        return queueName;
    }

    public void setQueueName(String queueName) {
        this.queueName = queueName;
    }

    public String getAETitle() {
        return aeTitle;
    }

    public void setAETitle(String aeTitle) {
        this.aeTitle = aeTitle;
    }

    public String getPrefetchCFindSCP() {
        return prefetchCFindSCP;
    }

    public void setPrefetchCFindSCP(String prefetchCFindSCP) {
        this.prefetchCFindSCP = prefetchCFindSCP;
    }

    public String getPrefetchCMoveSCP() {
        return prefetchCMoveSCP;
    }

    public void setPrefetchCMoveSCP(String prefetchCMoveSCP) {
        this.prefetchCMoveSCP = prefetchCMoveSCP;
    }

    public String[] getPrefetchCStoreSCPs() {
        return prefetchCStoreSCPs;
    }

    public void setPrefetchCStoreSCPs(String... prefetchCStoreSCPs) {
        this.prefetchCStoreSCPs = prefetchCStoreSCPs;
    }

    public String getDestinationCFindSCP() {
        return destinationCFindSCP;
    }

    public void setDestinationCFindSCP(String destinationCFindSCP) {
        this.destinationCFindSCP = destinationCFindSCP;
    }

    public HL7Conditions getConditions() {
        return conditions;
    }

    public void setConditions(HL7Conditions conditions) {
        this.conditions = conditions;
    }

    public Duration getSuppressDuplicateRetrieveInterval() {
        return suppressDuplicateRetrieveInterval;
    }

    public void setSuppressDuplicateRetrieveInterval(Duration suppressDuplicateRetrieveInterval) {
        this.suppressDuplicateRetrieveInterval = suppressDuplicateRetrieveInterval;
    }

    public int getSuppressDuplicateHistorySize() {
        return suppressDuplicateHistorySize;
    }

    public void setSuppressDuplicateHistorySize(int suppressDuplicateHistorySize) {
        this.suppressDuplicateHistorySize = suppressDuplicateHistorySize;
    }

    public String getPrefetchDeviceName() {
        return prefetchDeviceName;
    }

    public void setPrefetchDeviceName(String prefetchDeviceName) {
        this.prefetchDeviceName = prefetchDeviceName;
    }

    public NullifyIssuer getIgnoreAssigningAuthorityOfPatientID() {
        return ignoreAssigningAuthorityOfPatientID;
    }

    public void setIgnoreAssigningAuthorityOfPatientID(NullifyIssuer ignoreAssigningAuthorityOfPatientID) {
        this.ignoreAssigningAuthorityOfPatientID = ignoreAssigningAuthorityOfPatientID;
    }

    public Issuer[] getAssigningAuthorityOfPatientIDs() {
        return assigningAuthorityOfPatientIDs;
    }

    public void setAssigningAuthorityOfPatientIDs(Issuer... assigningAuthorityOfPatientIDs) {
        this.assigningAuthorityOfPatientIDs = assigningAuthorityOfPatientIDs;
    }

    public IDWithIssuer ignoreAssigningAuthorityOfPatientID(IDWithIssuer pid) {
        return ignoreAssigningAuthorityOfPatientID != null
                && ignoreAssigningAuthorityOfPatientID.test(pid.getIssuer(), assigningAuthorityOfPatientIDs)
                ? pid.withoutIssuer()
                : pid;
    }

    public Issuer getPrefetchForAssigningAuthorityOfPatientID() {
        return prefetchForAssigningAuthorityOfPatientID;
    }

    public void setPrefetchForAssigningAuthorityOfPatientID(Issuer prefetchForAssigningAuthorityOfPatientID) {
        this.prefetchForAssigningAuthorityOfPatientID = prefetchForAssigningAuthorityOfPatientID;
    }

    public EntitySelector[] getEntitySelectors() {
        return entitySelectors;
    }

    public void setEntitySelectors(EntitySelector[] entitySelectors) {
        this.entitySelectors = entitySelectors;
    }

    public ScheduleExpression[] getSchedules() {
        return schedules;
    }

    public void setSchedules(ScheduleExpression... schedules) {
        this.schedules = schedules;
    }

    public String getPrefetchDateTimeField() {
        return prefetchDateTimeField;
    }

    public void setPrefetchDateTimeField(String prefetchDateTimeField) {
        this.prefetchDateTimeField = prefetchDateTimeField;
    }

    public Duration getPrefetchInAdvance() {
        return prefetchInAdvance;
    }

    public void setPrefetchInAdvance(Duration prefetchInAdvance) {
        this.prefetchInAdvance = prefetchInAdvance;
    }

    public boolean match(String hostName, HL7Fields hl7Fields) {
        return conditions.match(hostName, hl7Fields);
    }

    @Override
    public String toString() {
        return "HL7PrefetchRule{" +
                "cn=" + commonName +
                ", queueName=" + queueName +
                ", aeTitle=" + aeTitle +
                ", findSCP=" + prefetchCFindSCP +
                ", moveSCP=" + prefetchCMoveSCP +
                ", storeSCPs=" + Arrays.toString(prefetchCStoreSCPs) +
                ", destFindSCP=" + destinationCFindSCP +
                ", prefetchDeviceName=" + prefetchDeviceName +
                ", conditions=" + conditions +
                ", suppressDups=" + suppressDuplicateRetrieveInterval +
                ", ignoreAssigningAuthorityOfPatientID=" + ignoreAssigningAuthorityOfPatientID +
                ", issuerOfPatientIDs=" + Arrays.toString(assigningAuthorityOfPatientIDs) +
                ", prefetchForAssigningAuthorityOfPatientID=" + prefetchForAssigningAuthorityOfPatientID +
                ", entitySelectors=" + Arrays.toString(entitySelectors) +
                ", schedules=" + Arrays.toString(schedules) +
                ", prefetchDateTimeField=" + prefetchDateTimeField +
                ", prefetchInAdvance=" + prefetchInAdvance +
                '}';
    }
}
