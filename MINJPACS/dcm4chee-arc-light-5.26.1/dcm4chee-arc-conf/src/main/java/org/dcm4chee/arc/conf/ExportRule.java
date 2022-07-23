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

import java.util.Arrays;
import java.util.Calendar;
import java.util.function.Predicate;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Oct 2015
 */
public class ExportRule {

    public static final ExportRule[] EMPTY = {};
    private String commonName;
    private ScheduleExpression[] schedules = {};
    private Conditions conditions = new Conditions();
    private String exporterDeviceName;
    private String[] exporterIDs = {};
    private Entity entity;
    private Duration exportDelay;
    private boolean exportPreviousEntity;
    private ExportReoccurredInstances exportReoccurredInstances = ExportReoccurredInstances.REPLACE;

    public ExportRule() {
    }

    public ExportRule(String commonName) {
        setCommonName(commonName);
    }

    public final String getCommonName() {
        return commonName;
    }

    public void setCommonName(String commonName) {
        this.commonName = commonName;
    }

    public ScheduleExpression[] getSchedules() {
        return schedules;
    }

    public void setSchedules(ScheduleExpression... schedules) {
        this.schedules = schedules;
    }

    public Conditions getConditions() {
        return conditions;
    }

    public void setConditions(Conditions conditions) {
        this.conditions = conditions;
    }

    public String getExporterDeviceName() {
        return exporterDeviceName;
    }

    public void setExporterDeviceName(String exporterDeviceName) {
        this.exporterDeviceName = exporterDeviceName;
    }

    public String[] getExporterIDs() {
        return exporterIDs;
    }

    public void setExporterIDs(String... exporterIDs) {
        this.exporterIDs = exporterIDs;
    }

    public Entity getEntity() {
        return entity;
    }

    public void setEntity(Entity entity) {
        switch (entity) {
            case Study:
            case Series:
            case Instance:
                this.entity = entity;
                break;
            default:
                throw new IllegalArgumentException("entity: " + entity);
        }
    }

    public Duration getExportDelay() {
        return exportDelay;
    }

    public void setExportDelay(Duration exportDelay) {
        this.exportDelay = exportDelay;
    }

    public boolean isExportPreviousEntity() {
        return exportPreviousEntity;
    }

    public void setExportPreviousEntity(boolean exportPreviousEntity) {
        this.exportPreviousEntity = exportPreviousEntity;
    }

    public ExportReoccurredInstances getExportReoccurredInstances() {
        return exportReoccurredInstances;
    }

    public void setExportReoccurredInstances(ExportReoccurredInstances exportReoccurredInstances) {
        this.exportReoccurredInstances = exportReoccurredInstances;
    }

    public boolean match(Predicate<ExportReoccurredInstances> predicate, Calendar now,
            String sendingHost, String sendingAET, String receivingHost, String receivingAET,
            Attributes attrs) {
        return predicate.test(exportReoccurredInstances)
                && ScheduleExpression.emptyOrAnyContains(now, schedules)
                && conditions.match(sendingHost, sendingAET, receivingHost, receivingAET, attrs);
    }

    @Override
    public String toString() {
        return "ExportRule{" +
                "cn=" + commonName +
                ", conditions=" + conditions +
                ", schedules=" + Arrays.toString(schedules) +
                ", exporterDeviceName=" + exporterDeviceName +
                ", exporterIDs=" + Arrays.toString(exporterIDs) +
                ", entity=" + entity +
                ", exporterDelay=" + exportDelay +
                ", exportPreviousEntity=" + exportPreviousEntity +
                ", exportReoccurredInstances=" + exportReoccurredInstances +
                '}';
    }
}
