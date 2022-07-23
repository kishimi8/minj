package org.dcm4chee.arc.export.mgt.impl;

import org.dcm4che3.conf.api.ConfigurationException;
import org.dcm4che3.conf.api.IDeviceCache;
import org.dcm4che3.net.Device;
import org.dcm4che3.net.service.DicomServiceException;
import org.dcm4chee.arc.conf.*;
import org.dcm4chee.arc.export.mgt.ExportManager;
import org.dcm4chee.arc.store.StoreContext;
import org.dcm4chee.arc.store.StoreSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ejb.EJBException;
import javax.enterprise.context.ApplicationScoped;
import javax.enterprise.event.Observes;
import javax.inject.Inject;
import java.util.Calendar;
import java.util.Date;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Oct 2015
 */
@ApplicationScoped
public class ExportScheduler {

    private static final Logger LOG = LoggerFactory.getLogger(ExportScheduler.class);

    @Inject
    private Device device;

    @Inject
    private ExportManager ejb;

    @Inject
    private IDeviceCache deviceCache;

    public void onStore(@Observes StoreContext ctx) {
        if (ctx.getException() != null)
            return;

        StoreSession session = ctx.getStoreSession();
        Calendar now = Calendar.getInstance();
        ArchiveAEExtension arcAE = session.getArchiveAEExtension();
        arcAE.exportRules()
                .filter(rule -> rule.match(ctx::match, now,
                                        session.getRemoteHostName(),
                                        session.getCallingAET(),
                                        session.getLocalHostName(),
                                        session.getCalledAET(),
                                        ctx.getAttributes()))
                .flatMap(rule -> Stream.of(rule.getExporterIDs())
                        .map(exporterID1 -> new Object[]{exporterID1, rule}))
                .collect(Collectors.toMap(a -> (String) a[0], a -> (ExportRule) a[1],
                        (r1, r2) -> r1.getEntity().compareTo(r2.getEntity()) < 0 ? r1 : r2))
                .forEach((exporterID, rule) -> updateOrCreateExportTask(ctx, now, exporterID, rule));
    }

    private void updateOrCreateExportTask(StoreContext ctx, Calendar now, String exporterID, ExportRule rule) {
        StoreSession session = ctx.getStoreSession();
        String exporterDeviceName = rule.getExporterDeviceName();
        Device exporterDevice = device;
        if (exporterDeviceName != null && !exporterDeviceName.equals(device.getDeviceName())) {
            try {
                exporterDevice = deviceCache.findDevice(exporterDeviceName);
            } catch (ConfigurationException e) {
                LOG.warn("{}: Failed to process {} - ", session, rule, e);
                return;
            }
        }
        ArchiveDeviceExtension arcDev = exporterDevice.getDeviceExtension(ArchiveDeviceExtension.class);
        if (arcDev == null) {
            LOG.warn("{}: Failed to process {} - {} is not an Archive Device", session, rule,
                    exporterDevice.getDeviceName());
            return;
        }
        ExporterDescriptor exporterDesc = arcDev.getExporterDescriptor(exporterID);
        if (exporterDesc == null) {
            LOG.warn("{}: Failed to process {} - no Exporter {} configured on Archive Device {}", session, rule,
                    exporterID, exporterDevice.getDeviceName());
            return;
        }
        String queueName = exporterDesc.getQueueName();
        QueueDescriptor queueDesc = arcDev.getQueueDescriptor(queueName);
        if (queueDesc == null) {
            LOG.warn("{}: Failed to process {} - no Queue {} configured on Archive Device {}", session, rule,
                    queueName, exporterDevice.getDeviceName());
            return;
        }
        Date scheduledTime = scheduledTime(now, rule.getExportDelay(), exporterDesc.getSchedules());
        switch (rule.getEntity()) {
            case Study:
                createOrUpdateStudyExportTask(session, exporterDevice.getDeviceName(), exporterDesc,
                        ctx.getStudyInstanceUID(), scheduledTime);
                if (rule.isExportPreviousEntity() && ctx.isPreviousDifferentStudy())
                    createOrUpdateStudyExportTask(session, exporterDevice.getDeviceName(), exporterDesc,
                            ctx.getPreviousInstance().getSeries().getStudy().getStudyInstanceUID(),
                            scheduledTime);
                break;
            case Series:
                createOrUpdateSeriesExportTask(session, exporterDevice.getDeviceName(), exporterDesc,
                        ctx.getStudyInstanceUID(),
                        ctx.getSeriesInstanceUID(),
                        scheduledTime);
                if (rule.isExportPreviousEntity() && ctx.isPreviousDifferentSeries())
                    createOrUpdateSeriesExportTask(session, exporterDevice.getDeviceName(), exporterDesc,
                            ctx.getPreviousInstance().getSeries().getStudy().getStudyInstanceUID(),
                            ctx.getPreviousInstance().getSeries().getSeriesInstanceUID(),
                            scheduledTime);
                break;
            case Instance:
                createOrUpdateInstanceExportTask(session, exporterDevice.getDeviceName(), exporterDesc,
                        ctx.getStudyInstanceUID(),
                        ctx.getSeriesInstanceUID(),
                        ctx.getSopInstanceUID(),
                        scheduledTime);
                break;
        }
    }

    private Date scheduledTime(Calendar cal, Duration exportDelay, ScheduleExpression[] schedules) {
        if (exportDelay != null) {
            cal = (Calendar) cal.clone();
            cal.add(Calendar.SECOND, (int) exportDelay.getSeconds());
        }
        cal = ScheduleExpression.ceil(cal, schedules);
        return cal.getTime();
    }

    private boolean createOrUpdateStudyExportTask(StoreSession session, String deviceName,
                                                  ExporterDescriptor exporterDesc,
                                                  String studyIUID, Date scheduledTime) {
        ArchiveAEExtension arcAE = session.getArchiveAEExtension();
        ArchiveDeviceExtension arcDev = arcAE.getArchiveDeviceExtension();
        int retries = arcDev.getStoreUpdateDBMaxRetries();
        for (;;) {
            try {
                ejb.createOrUpdateStudyExportTask(deviceName, exporterDesc, studyIUID, scheduledTime);
                return true;
            } catch (EJBException e) {
                if (retries-- > 0) {
                    LOG.info("{}: Failed to update Study Export Task caused by {} - retry", session,
                            DicomServiceException.initialCauseOf(e));
                } else {
                    LOG.warn("{}: Failed to update Study Export Task:\n", session, e);
                    return false;
                }
            }
            try {
                Thread.sleep(arcDev.storeUpdateDBRetryDelay());
            } catch (InterruptedException e) {
                LOG.info("{}: Failed to delay retry to update Study Export Task:\n", session, e);
            }
        }
    }

    private boolean createOrUpdateSeriesExportTask(StoreSession session, String deviceName,
                                                   ExporterDescriptor exporterDesc,
                                                   String studyIUID, String seriesIUID, Date scheduledTime) {
        ArchiveAEExtension arcAE = session.getArchiveAEExtension();
        ArchiveDeviceExtension arcDev = arcAE.getArchiveDeviceExtension();
        int retries = arcDev.getStoreUpdateDBMaxRetries();
        for (;;) {
            try {
                ejb.createOrUpdateSeriesExportTask(deviceName, exporterDesc,
                        studyIUID, seriesIUID, scheduledTime);
                return true;
            } catch (EJBException e) {
                if (retries-- > 0) {
                    LOG.info("{}: Failed to update Series Export Task caused by {} - retry", session,
                            DicomServiceException.initialCauseOf(e));
                } else {
                    LOG.warn("{}: Failed to update Series Export Task:\n", session, e);
                    return false;
                }
            }
            try {
                Thread.sleep(arcDev.storeUpdateDBRetryDelay());
            } catch (InterruptedException e) {
                LOG.info("{}: Failed to delay retry to update Series Export Task:\n", session, e);
            }
        }
    }

    private boolean createOrUpdateInstanceExportTask(StoreSession session, String deviceName,
                                                     ExporterDescriptor exporterDesc,
                                                     String studyIUID, String seriesIUID, String sopIUID,
                                                     Date scheduledTime) {
        ArchiveAEExtension arcAE = session.getArchiveAEExtension();
        ArchiveDeviceExtension arcDev = arcAE.getArchiveDeviceExtension();
        int retries = arcDev.getStoreUpdateDBMaxRetries();
        for (;;) {
            try {
                ejb.createOrUpdateInstanceExportTask(deviceName, exporterDesc,
                        studyIUID, seriesIUID, sopIUID, scheduledTime);
                return true;
            } catch (EJBException e) {
                if (retries-- > 0) {
                    LOG.info("{}: Failed to update Instance Export Task caused by {} - retry", session,
                            DicomServiceException.initialCauseOf(e));
                } else {
                    LOG.warn("{}: Failed to update Instance Export Task:\n", session, e);
                    return false;
                }
            }
            try {
                Thread.sleep(arcDev.storeUpdateDBRetryDelay());
            } catch (InterruptedException e) {
                LOG.info("{}: Failed to delay retry to update Instance Export Task:\n", session, e);
            }
        }
    }
}
