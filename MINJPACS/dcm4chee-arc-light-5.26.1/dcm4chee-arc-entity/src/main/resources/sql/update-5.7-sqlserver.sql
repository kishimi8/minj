alter table patient add resp_person_fk bigint;
alter table patient add constraint FK_56r2g5ggptqgcvb3hl11adke2 foreign key (resp_person_fk) references person_name;
create index FK_56r2g5ggptqgcvb3hl11adke2 on patient (resp_person_fk) ;

alter table study alter column storage_ids varchar(255) null;
alter table study add ext_retrieve_aet varchar(255);

alter table series add ext_retrieve_aet varchar(255);
alter table series alter column series_no int null;

alter table instance add ext_retrieve_aet varchar(255);
alter table instance add num_frames int;
alter table instance alter column inst_no int null;

create index UK_cl9dmi0kb97ov1cjh7rn3dhve on study (ext_retrieve_aet);
create index UK_6ry2squ4qcv129lxpae1oy93m on study (created_time);
drop index UK_3tvtv5bjrpem0qjc3qo84bgsl on instance;

create table stgcmt_result (
    pk bigint identity not null,
    created_time datetime2 not null,
    device_name varchar(255) not null,
    exporter_id varchar(255) not null,
    num_failures int,
    num_instances int,
    series_iuid varchar(255),
    sop_iuid varchar(255),
    stgcmt_status int not null,
    study_iuid varchar(255) not null,
    transaction_uid varchar(255) not null,
    updated_time datetime2 not null,
    primary key (pk));

alter table stgcmt_result add constraint UK_ey6qpep2qtiwayou7pd0vj22w  unique (transaction_uid);
create index UK_qko59fn9pb87j1eu070ilfkhm on stgcmt_result (updated_time);
create index UK_7ltjgxoijy15rrwihl8euv7vh on stgcmt_result (device_name);
create index UK_gu96kxnbf2p84d1katepo0btq on stgcmt_result (exporter_id);
create index UK_p65blcj4h0uh2itb0bp49mc07 on stgcmt_result (study_iuid);
create index UK_nyoefler7agcmxc8t8yfngq7e on stgcmt_result (stgcmt_status);

SELECT name FROM sys.key_constraints WHERE type = 'PK' AND OBJECT_NAME(parent_object_id) = N'sps_station_aet';
-- replace the value of constraint below with the value you get from above select statement --
alter table sps_station_aet drop constraint <Your-SPS_STATION_AET-PK-ConstraintName>;
alter table sps_station_aet drop column pk;
