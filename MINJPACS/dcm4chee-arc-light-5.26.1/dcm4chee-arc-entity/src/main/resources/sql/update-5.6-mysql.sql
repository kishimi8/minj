alter table patient add num_studies integer;
update patient set num_studies = (
  select count(*) from study where study.patient_fk=patient.pk and study.rejection_state in (0,1));
alter table patient modify num_studies integer not null;
create index UK_296rccryifu6d8byisl2f4dvq on patient (num_studies);

alter table location add multi_ref integer, add uidmap_fk bigint, add object_type integer;
update location set object_type = 0;
alter table location modify object_type integer not null;
alter table location modify tsuid varchar(255);
create table uidmap (pk bigint not null auto_increment, uidmap longblob not null, primary key (pk));

alter table instance add inst_no_int integer;
update instance set inst_no_int = inst_no where inst_no != '*';
alter table instance drop inst_no;
alter table instance change inst_no_int inst_no integer;
alter table series add series_no_int integer;
update series set series_no_int = series_no where series_no != '*';
alter table series drop series_no;
alter table series change series_no_int series_no integer;

create index UK_i1lnahmehau3r3j9pdyxg3p3y on location (multi_ref);
alter table location add constraint FK_bfk5vl6eoxaf0hhwiu3rbgmkn foreign key (uidmap_fk) references uidmap (pk);

create index UK_j6aadbh7u93bpmv18s1inrl1r on series (failed_retrieves);
create index UK_9qvng5j8xnli8yif7p0rjngb2 on study (failed_retrieves);

create index UK_twtj9t0jbl07buyisdtvqrpy on series (failed_iuids);
create index UK_btfu9p1kwhrr444muytvxguci on study (failed_iuids);