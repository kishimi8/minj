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

import org.dcm4chee.arc.conf.Availability;

import javax.persistence.*;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 *
 */
@NamedQueries({
@NamedQuery(
    name = SeriesQueryAttributes.FIND_BY_VIEW_ID_AND_SERIES_PK,
    query = "select a from SeriesQueryAttributes a where a.viewID = ?1 and a.series.pk = ?2"
),
@NamedQuery(
    name = SeriesQueryAttributes.DELETE_FOR_SERIES,
    query = "delete from SeriesQueryAttributes a where a.series = ?1"
),
@NamedQuery(
    name = SeriesQueryAttributes.VIEW_IDS_FOR_SERIES_PK,
    query = "select a.viewID from SeriesQueryAttributes a where a.series.pk = ?1"),
@NamedQuery(
    name = SeriesQueryAttributes.UPDATE_AVAILABILITY_BY_STUDY_PK,
    query = "update SeriesQueryAttributes serQueryAttrs set serQueryAttrs.availability = ?2 " +
            "where serQueryAttrs.series in (" +
                "select ser from Series ser where ser.study = ?1)"),
@NamedQuery(
        name = SeriesQueryAttributes.UPDATE_AVAILABILITY_BY_STUDY_IUID,
        query = "update SeriesQueryAttributes serQueryAttrs set serQueryAttrs.availability = ?2 " +
                "where serQueryAttrs.series in (" +
                "select ser from Series ser where ser.study.studyInstanceUID = ?1)"),
@NamedQuery(
        name = SeriesQueryAttributes.UPDATE_AVAILABILITY_BY_SERIES_IUID,
        query = "update SeriesQueryAttributes serQueryAttrs set serQueryAttrs.availability = ?2 " +
                "where serQueryAttrs.series in (" +
                "select ser from Series ser where ser.seriesInstanceUID = ?1)")
})
@Entity
@Table(name = "series_query_attrs", uniqueConstraints =
    @UniqueConstraint(columnNames = { "view_id", "series_fk" }))
public class SeriesQueryAttributes {

    public static final String FIND_BY_VIEW_ID_AND_SERIES_PK = "SeriesQueryAttributes.findByViewIDAndSeriesPk";
    public static final String DELETE_FOR_SERIES = "SeriesQueryAttributes.deleteForSeries";
    public static final String VIEW_IDS_FOR_SERIES_PK = "SeriesQueryAttributes.viewIDsForSeriesPk";
    public static final String UPDATE_AVAILABILITY_BY_STUDY_PK = "SeriesQueryAttributes.updateAvailabilityByStudyPk";
    public static final String UPDATE_AVAILABILITY_BY_STUDY_IUID = "SeriesQueryAttributes.updateAvailabilityByStudyIUID";
    public static final String UPDATE_AVAILABILITY_BY_SERIES_IUID = "SeriesQueryAttributes.updateAvailabilityBySeriesIUID";

    @Id
    @GeneratedValue(strategy=GenerationType.IDENTITY)
    @Column(name = "pk")
    private long pk;

    @Column(name = "view_id")
    private String viewID;

    @Column(name = "num_instances")
    private int numberOfInstances;

    @Column(name = "cuids_in_series")
    private String sopClassesInSeries;

    @Column(name = "retrieve_aets")
    private String retrieveAETs;

    @Column(name = "availability")
    private Availability availability;

    @ManyToOne(optional = false)
    @JoinColumn(name = "series_fk")
    private Series series;

    public long getPk() {
        return pk;
    }

    public String getViewID() {
        return viewID;
    }

    public void setViewID(String viewID) {
        this.viewID = viewID;
    }

    public int getNumberOfInstances() {
        return numberOfInstances;
    }

    public void setNumberOfInstances(int numberOfInstances) {
        this.numberOfInstances = numberOfInstances;
    }

    public String getSOPClassesInSeries() {
        return sopClassesInSeries;
    }

    public void setSOPClassesInSeries(String sopClassesInSeries) {
        this.sopClassesInSeries = sopClassesInSeries;
    }

    public String getRetrieveAETs() {
        return retrieveAETs;
    }

    public void setRetrieveAETs(String retrieveAETs) {
        this.retrieveAETs = retrieveAETs;
    }

    public Availability getAvailability() {
        return availability;
    }

    public void setAvailability(Availability availability) {
        this.availability = availability;
    }

    public Series getSeries() {
        return series;
    }

    public void setSeries(Series series) {
        this.series = series;
    }
}
