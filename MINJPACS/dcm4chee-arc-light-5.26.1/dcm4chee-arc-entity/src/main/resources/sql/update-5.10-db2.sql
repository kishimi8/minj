alter table study alter ext_retrieve_aet set not null;

alter table queue_msg alter queue_name set not null;
alter table export_task add created_time timestamp add updated_time timestamp add num_instances integer add modalities varchar(255) add queue_msg_fk bigint;
update export_task set created_time = current_timestamp, updated_time = current_timestamp;
alter table export_task alter created_time set not null alter updated_time set not null;
alter table export_task add constraint FK_g6atpiywpo2100kn6ovix7uet foreign key (queue_msg_fk) references queue_msg;

drop index UK_cxaqwh62doxvy1itpdi43c681;

alter table study add completeness integer;
update study set completeness = 2;
alter table study alter completeness set not null;
alter table series add completeness integer;
update series set completeness = 2;
alter table series alter completeness set not null;

---not working
update study set ext_retrieve_aet = '*' where ext_retrieve_aet is null;
alter table export_task drop constraint UK_aoqbyfnen6evu73ltc1osexfr;
create index UK_c5cof80jx0oopvovf3p4jv4l8 on export_task (device_name);
create index UK_p5jjs08sdp9oecvr93r2g0kyq on export_task (updated_time);
create index UK_j1t0mj3vlmf5xwt4fs5xida1r on export_task (scheduled_time);
create index UK_q7gmfr3aog1hateydhfeiu7si on export_task (exporter_id);
create index UK_hb9rftf7opmg56nkg7dkvsdc8 on export_task (study_iuid, series_iuid, sop_iuid);
create index FK_g6atpiywpo2100kn6ovix7uet on export_task (queue_msg_fk);


update study set completeness = 1 where failed_retrieves > 0 and failed_iuids is not null;
update study set completeness = 0 where failed_retrieves = 0 and failed_iuids = '*';
alter table study drop failed_iuids;
create index UK_gl5rq54a0tr8nreu27c2t04rb on study (completeness);
update series set completeness = 1 where failed_retrieves > 0 and failed_iuids is not null;
update series set completeness = 0 where failed_retrieves = 0 and failed_iuids = '*';
alter table series drop failed_iuids;
create index UK_4lnegvfs65fbkjn7nmg9s8usy on series (completeness);