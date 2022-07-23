alter table study add modified_time datetime;
update study set modified_time = updated_time;
alter table study modify modified_time datetime not null;

create table metadata (pk bigint not null, digest varchar(255), object_size bigint not null, status integer not null, storage_id varchar(255) not null, storage_path varchar(255) not null, primary key (pk));

alter table series add metadata_update_time datetime, add metadata_fk bigint, add inst_purge_time datetime, add inst_purge_state integer;
update series set inst_purge_state = 0;
alter table series modify inst_purge_state integer not null;

alter table series add constraint FK_pu4p7k1o9hleuk9rmxvw2ybj6 foreign key (metadata_fk) references metadata (pk);

delete from series_query_attrs;
alter table series_query_attrs add cuids_in_series varchar(255);

create index UK_f7c9hmq8pfypohkgkp5vkbhxp on metadata (storage_id(64), status);
create index UK_hwkcpd7yv0nca7o918wm4bn69 on series (metadata_update_time);
create index UK_a8vyikwd972jomyb3f6brcfh5 on series (inst_purge_time);
create index UK_er4ife08f6eaki91gt3hxt5e on series (inst_purge_state);