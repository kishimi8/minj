/*
 * ** BEGIN LICENSE BLOCK *****
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
 * Portions created by the Initial Developer are Copyright (C) 2016
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
 * ** END LICENSE BLOCK *****
 */

package org.dcm4chee.arc.metadata;

import org.dcm4chee.arc.entity.Metadata;
import org.dcm4chee.arc.entity.Series;

import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.TemporalType;
import java.util.Date;
import java.util.List;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Nov 2016
 */
@Stateless
public class UpdateMetadataEJB {

    @PersistenceContext(unitName="dcm4chee-arc")
    private EntityManager em;

    public List<Series.MetadataUpdate> findSeriesForScheduledMetadataUpdate(int fetchSize) {
        return em.createNamedQuery(Series.SCHEDULED_METADATA_UPDATE, Series.MetadataUpdate.class)
                .setMaxResults(fetchSize)
                .getResultList();
    }

    public boolean claim(Series.MetadataUpdate metadataUpdate) {
        return em.createNamedQuery(Series.CLAIM_UPDATE_METADATA)
                .setParameter(1, metadataUpdate.seriesPk)
                .setParameter(2, metadataUpdate.scheduledUpdateTime)
                .executeUpdate() > 0;
    }

    public void incrementMetadataUpdateFailures(Long seriesPk, Date time) {
        em.createNamedQuery(Series.INCREMENT_METADATA_UPDATE_FAILURES)
                .setParameter(1, seriesPk)
                .setParameter(2, time, TemporalType.TIMESTAMP)
                .executeUpdate();
    }

    public void commit(Long seriesPk, Metadata metadata) {
        em.persist(metadata);
        em.createNamedQuery(Metadata.SET_STATUS_BY_SERIES_PK)
                .setParameter(1, seriesPk)
                .setParameter(2, Metadata.Status.TO_DELETE)
                .executeUpdate();
        em.createNamedQuery(Series.SET_METADATA)
                .setParameter(1, seriesPk)
                .setParameter(2, metadata)
                .executeUpdate();
    }
}
