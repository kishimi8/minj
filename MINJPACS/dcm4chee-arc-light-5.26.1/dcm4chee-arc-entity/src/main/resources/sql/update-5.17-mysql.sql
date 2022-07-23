-- part 1: can be applied on archive running archive 5.16
alter table queue_msg add batch_id varchar(255);
alter table retrieve_task
    add device_name varchar(255),
    add queue_name varchar(255),
    add batch_id varchar(255);
alter table retrieve_task modify queue_msg_fk bigint not null;
alter table stgcmt_result modify exporter_id varchar(255) not null;
alter table series add metadata_update_failures integer;
alter table metadata add created_time timestamp;

update queue_msg set batch_id = batchID;
update retrieve_task
    set device_name = (select queue_msg.device_name from queue_msg
                   where queue_msg_fk = queue_msg.pk);
update retrieve_task
    set queue_name = (select queue_msg.queue_name from queue_msg
                  where queue_msg_fk = queue_msg.pk);
update retrieve_task
    set batch_id = (select queue_msg.batch_id from queue_msg
                where queue_msg_fk = queue_msg.pk);
update series set metadata_update_failures = 0;
update metadata
    set created_time = (select series.updated_time from series
                    where metadata.pk = metadata_fk);
update metadata set created_time='2000-01-01 00:00:00' where status != 0 and created_time is null;

create index UK_ln9rs61la03lhvgiv8c2wehnr on queue_msg (batch_id);
create index UK_djkqk3dls3xkru1n0c3p5rm3 on retrieve_task (device_name);
create index UK_r866eptnxfw7plhxwtm3vks0e on retrieve_task (queue_name);
create index UK_ahkqwir2di2jm44jlhi22iw3e on retrieve_task (batch_id);
create index UK_6xqpk4cvy49wj41p2qwixro8w on series (metadata_update_failures);

-- part 2: shall be applied on stopped archive before starting 5.17
update queue_msg set batch_id = batchID where batch_id <> batchID;
update retrieve_task
    set device_name = (select queue_msg.device_name from queue_msg
                    where queue_msg_fk = queue_msg.pk and retrieve_task.device_name is null);
update retrieve_task
    set queue_name = (select queue_msg.queue_name from queue_msg
                    where queue_msg_fk = queue_msg.pk and retrieve_task.device_name is null);
update retrieve_task
    set batch_id = (select queue_msg.batch_id from queue_msg
                    where queue_msg_fk = queue_msg.pk and retrieve_task.device_name is null);
update series set metadata_update_failures = 0 where metadata_update_failures is null;
update metadata
    set created_time = (select series.updated_time from series
                    where metadata.pk = metadata_fk and metadata.created_time is null);
update metadata set created_time='2000-01-01 00:00:00' where status != 0 and created_time is null;

-- part 3: can be applied on already running archive 5.17
alter table queue_msg drop batchID;
alter table retrieve_task modify device_name varchar(255) not null;
alter table retrieve_task modify queue_name varchar(255) not null;
alter table series modify metadata_update_failures integer not null;
alter table metadata modify created_time datetime not null;
