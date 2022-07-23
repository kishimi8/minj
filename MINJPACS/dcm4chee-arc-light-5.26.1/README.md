DCM4CHEE Archive 5.x
====================
Sources: https://github.com/dcm4che/dcm4chee-arc-light   
Binaries: https://sourceforge.net/projects/dcm4che/files/dcm4chee-arc-light5/  
Issue Tracker:  https://github.com/dcm4che/dcm4chee-arc-light/issues   
Wiki:  https://github.com/dcm4che/dcm4chee-arc-light/wiki   

DICOM Archive Java EE application running in WildFly.

This is a complete rewrite of [DCM4CHEE Archive 2.x](http://www.dcm4che.org/confluence/display/ee2/Home).

One major improvement to 2.x is the use of LDAP as central configuration,
compliant to the DICOM Application Configuration Management Profile,
specified in [DICOM 2015, Part 15, Annex H][1].

In long term, 5.x will provide the functionality of 2.x, and there will
be migration tools to upgrade existing installations of 2.x to 5.x.

Build
-----

* Make sure you have [Maven 3](http://maven.apache.org) installed.

* Build `master` branch of [dcm4che 3 Library](https://github.com/dcm4che/dcm4che) -
  only necessary to build unreleased version, which is not (yet) available in the Maven repository:

        > $git clone https://github.com/dcm4che/dcm4che.git
        > $cd dcm4che
        > $mvn install

* Build the Archive for a specific database:

        > $mvn install -D db={db2|firebird|h2|mysql|oracle|psql|sqlserver}

    with secured WEB UI:

        > $mvn install -D db={db2|firebird|h2|mysql|oracle|psql|sqlserver} -D secure=ui

    with secured WEB UI and secured RESTful services:

        > $mvn install -D db={db2|firebird|h2|mysql|oracle|psql|sqlserver} -D secure=all


Installation
------------
* [Installation](https://github.com/dcm4che/dcm4chee-arc-light/wiki/Installation)
* [Running on Docker](https://github.com/dcm4che/dcm4chee-arc-light/wiki/Running-on-Docker)

License
-------
* [Mozilla Public License Version 1.1](http://www.mozilla.org/MPL/1.1/)

[1]: http://dicom.nema.org/medical/dicom/current/output/chtml/part15/chapter_H.html
