<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:output method="xml"/>
  <xsl:include href="hl7-common.xsl"/>
  <xsl:param name="langCodeValue">en</xsl:param>
  <xsl:param name="langCodingSchemeDesignator">RFC5646</xsl:param>
  <xsl:param name="langCodeMeaning">English</xsl:param>
  <xsl:param name="docTitleCodeValue">11528-7</xsl:param>
  <xsl:param name="docTitleCodingSchemeDesignator">LN</xsl:param>
  <xsl:param name="docTitleCodeMeaning">Radiology Report</xsl:param>
  <xsl:param name="VerifyingOrganization">Verifying Organization</xsl:param>
  <xsl:template match="/hl7">
    <NativeDicomModel>
      <xsl:call-template name="const-attrs"/>
      <xsl:variable name="valueType" select="OBX/field[2]"/>
      <xsl:call-template name="institution">
        <xsl:with-param name="performingOrganizationName" select="OBX/field[23]/text()"/>
        <xsl:with-param name="sendingOrganization" select="MSH/field[2]/text()"/>
      </xsl:call-template>
      <xsl:variable name="ed" select="OBX[field[2]/text()='ED']"/>
      <xsl:choose>
        <xsl:when test="$valueType = 'HD'">
          <xsl:call-template name="rad28">
            <xsl:with-param name="ed" select="$ed"/>
          </xsl:call-template>
        </xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="rad128">
            <xsl:with-param name="ed" select="$ed"/>
          </xsl:call-template>
        </xsl:otherwise>
      </xsl:choose>

      <xsl:apply-templates select="PID"/>
      <xsl:apply-templates select="PV1"/>
      <!-- Admission ID, Issuer -->
      <xsl:call-template name="admissionID">
        <xsl:with-param name="visitNumber" select="PV1/field[19]"/>
        <xsl:with-param name="patientAccountNumber" select="PID/field[18]"/>
      </xsl:call-template>

      <xsl:choose>
        <xsl:when test="$ed">
          <xsl:call-template name="ed"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:call-template name="sr-const-attrs"/>
          <!--Content Sequence-->
          <DicomAttribute tag="0040A730" vr="SQ">
            <xsl:call-template name="const-obsctx"/>
            <xsl:apply-templates select="OBR" mode="obsctx"/>
            <xsl:choose>
              <xsl:when test="$valueType = 'HD'">
                <xsl:apply-templates select="OBX[field[3]/component='SR Text']" mode="txt"/>
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="OBX" mode="rad128"/>
              </xsl:otherwise>
            </xsl:choose>
          </DicomAttribute>
        </xsl:otherwise>
      </xsl:choose>
    </NativeDicomModel>
  </xsl:template>
  
  <xsl:template name="institution">
    <xsl:param name="performingOrganizationName"/>
    <xsl:param name="sendingOrganization"/>
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080080'"/>
      <xsl:with-param name="vr" select="'LO'"/>
      <xsl:with-param name="val">
        <xsl:choose>
          <xsl:when test="$performingOrganizationName and string-length($performingOrganizationName) > 0">
            <xsl:value-of select="$performingOrganizationName"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="$sendingOrganization"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="rad28">
    <xsl:param name="ed"/>
    <!--SOP Instance UID-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080018'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="OBX[field[3]/component='SR Instance UID']/field[5]"/>
    </xsl:call-template>
    <!--Series Instance UID-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0020000E'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="normalize-space(OBX[field[3]/component='Series Instance UID'][1]/field[5])"/>
    </xsl:call-template>
    <!-- Study Instance UID -->
    <xsl:variable name="studyUID"
                  select="normalize-space(OBX[field[3]/component='Study Instance UID']/field[5])"/>
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0020000D'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="$studyUID"/>
    </xsl:call-template>
    <xsl:apply-templates select="OBR">
      <xsl:with-param name="sr" select="$ed"/>
      <xsl:with-param name="studyUID" select="$studyUID"/>
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template name="rad128">
    <xsl:param name="ed"/>
    <!--SOP Instance UID-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080018'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="OBX[field[3]/component='SR Instance UID']/field[5]"/>
    </xsl:call-template>
    <!--Series Instance UID-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0020000E'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="normalize-space(OBX[field[3]/component='Series Instance UID'][1]/field[5])"/>
    </xsl:call-template>
    <!-- Study Instance UID -->
    <xsl:variable name="studyUID" select="normalize-space(OBX[field[3]/component='DICOM Study']/field[5])"/>
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0020000D'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="$studyUID"/>
    </xsl:call-template>
    <xsl:apply-templates select="OBR">
      <xsl:with-param name="sr" select="$ed"/>
      <xsl:with-param name="studyUID" select="$studyUID"/>
    </xsl:apply-templates>
  </xsl:template>

  <xsl:template name="sr-const-attrs">
    <!--Modality-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080060'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="'SR'"/>
    </xsl:call-template>
    <!--Referenced Performed Procedure Step Sequence-->
    <DicomAttribute tag="00081111" vr="SQ"/>
    <!--SOP Class UID-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080016'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="'1.2.840.10008.5.1.4.1.1.88.11'"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="ed-const-attrs">
    <xsl:param name="mimeType"/>
    <xsl:choose>
      <xsl:when test="$mimeType='text/xml'">
        <xsl:call-template name="ed-cda-const-attrs"/>
      </xsl:when>
      <xsl:when test="$mimeType='application/pdf'">
        <!--SOP Class UID-->
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'00080016'"/>
          <xsl:with-param name="vr" select="'UI'"/>
          <xsl:with-param name="val" select="'1.2.840.10008.5.1.4.1.1.104.1'"/>
        </xsl:call-template>
        <!--Modality-->
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'00080060'"/>
          <xsl:with-param name="vr" select="'CS'"/>
          <xsl:with-param name="val" select="'DOC'"/>
        </xsl:call-template>
        <!--Conversion Type-->
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'00080064'"/>
          <xsl:with-param name="vr" select="'CS'"/>
          <xsl:with-param name="val" select="'SD'"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise/>
    </xsl:choose>
    <!--Burned In Annotation-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00280301'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="'NO'"/>
    </xsl:call-template>
    <!--Acquisition Date Time-->
    <DicomAttribute tag="0008002A" vr="DT"/>
    <!--Document Title-->
    <DicomAttribute tag="00420010" vr="ST"/>
  </xsl:template>

  <xsl:template name="ed-cda-const-attrs">
    <!--SOP Class UID-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080016'"/>
      <xsl:with-param name="vr" select="'UI'"/>
      <xsl:with-param name="val" select="'1.2.840.10008.5.1.4.1.1.104.2'"/>
    </xsl:call-template>
    <!--Modality-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080060'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="'SR'"/>
    </xsl:call-template>
    <!--Conversion Type-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080064'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="'WSD'"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="const-attrs">
    <!--Study Date-->
    <DicomAttribute tag="00080020" vr="DA"/>
    <!--Study Time-->
    <DicomAttribute tag="00080030" vr="TM"/>
    <!--Accession Number-->
    <DicomAttribute tag="00080050" vr="SH"/>
    <!--Manufacturer-->
    <DicomAttribute tag="00080070" vr="LO"/>
    <!--Referring Physician's Name-->
    <DicomAttribute tag="00080090" vr="PN"/>
    <!--Study ID-->
    <DicomAttribute tag="00200010" vr="SH"/>
    <!--Series Number-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00200011'"/>
      <xsl:with-param name="vr" select="'IS'"/>
      <xsl:with-param name="val" select="'1'"/>
    </xsl:call-template>
    <!--Instance Number-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00200013'"/>
      <xsl:with-param name="vr" select="'IS'"/>
      <xsl:with-param name="val" select="'1'"/>
    </xsl:call-template>
    <!--Value Type-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0040A040'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="'CONTAINER'"/>
    </xsl:call-template>
    <!--Concept Name Code Sequence-->
    <xsl:call-template name="codeItem">
      <xsl:with-param name="sqtag">0040A043</xsl:with-param>
      <xsl:with-param name="code" select="$docTitleCodeValue"/>
      <xsl:with-param name="scheme" select="$docTitleCodingSchemeDesignator"/>
      <xsl:with-param name="meaning" select="$docTitleCodeMeaning"/>
    </xsl:call-template>
    <!--Continuity Of Content-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0040A050'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="'SEPARATE'"/>
    </xsl:call-template>
    <!--Content Template Sequence-->
    <DicomAttribute tag="0040A504" vr="SQ"/>
  </xsl:template>

  <xsl:template match="OBR">
    <xsl:param name="ed"/>
    <xsl:param name="studyUID"/>
    <!--Content Date/Time-->
    <xsl:call-template name="attrDATM">
      <xsl:with-param name="datag" select="'00080023'"/>
      <xsl:with-param name="tmtag" select="'00080033'"/>
      <xsl:with-param name="val" select="field[7]"/>
    </xsl:call-template>
    <!--Accession Number-->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00080050'"/>
      <xsl:with-param name="vr" select="'SH'"/>
      <xsl:with-param name="val" select="field[18]"/>
    </xsl:call-template>
    <xsl:if test="not($ed)">
      <!--Referenced Request Sequence-->
      <DicomAttribute tag="0040A370" vr="SQ">
        <Item number="1">
          <!-- Study Instance UID -->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'0020000D'"/>
            <xsl:with-param name="vr" select="'UI'"/>
            <xsl:with-param name="val" select="$studyUID"/>
          </xsl:call-template>
          <!--Accession Number-->
          <DicomAttribute tag="00080050" vr="SH"/>
          <!--Referenced Study Sequence-->
          <DicomAttribute tag="00081110" vr="SQ"/>
          <!--Requested Procedure Description and Code Sequence-->
          <xsl:call-template name="ce2codeItemWithDesc">
            <xsl:with-param name="descTag" select="'00321060'"/>
            <xsl:with-param name="seqTag" select="'00321064'"/>
            <xsl:with-param name="codedEntry" select="field[4]"/>
          </xsl:call-template>
          <!-- Requested Procedure ID -->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'00401001'"/>
            <xsl:with-param name="vr" select="'SH'"/>
            <xsl:with-param name="val" select="string(field[19]/text())"/>
          </xsl:call-template>
          <!--Placer Order Number / Imaging Service Request-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'00402016'"/>
            <xsl:with-param name="vr" select="'LO'"/>
            <xsl:with-param name="val" select="field[2]"/>
          </xsl:call-template>
          <!--Filler Order Number / Imaging Service Request-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'00402017'"/>
            <xsl:with-param name="vr" select="'LO'"/>
            <xsl:with-param name="val" select="field[3]"/>
          </xsl:call-template>
        </Item>
      </DicomAttribute>
    </xsl:if>
    <!-- Verifying Observer Sequence -->
    <DicomAttribute tag="0040A073" vr="SQ">
      <Item number="1">
        <!-- Verifying Organization -->
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'0040A027'"/>
          <xsl:with-param name="vr" select="'LO'"/>
          <xsl:with-param name="val" select="$VerifyingOrganization"/>
        </xsl:call-template>
        <!-- Verification DateTime -->
        <xsl:call-template name="attrDT">
          <xsl:with-param name="dtTag" select="'0040A030'"/>
          <xsl:with-param name="val" select="field[7]"/>
        </xsl:call-template>
        <!-- Verifying Observer Name -->
        <xsl:choose>
          <xsl:when test="field[32]/text()">
            <xsl:call-template name="cnn2pnAttr">
              <xsl:with-param name="tag" select="'0040A075'"/>
              <xsl:with-param name="cn" select="field[32]"/>
            </xsl:call-template>
          </xsl:when>
          <xsl:otherwise>
            <DicomAttribute tag="0040A075" vr="PN">
              <PersonName number="1">
                <Alphabetic>
                  <FamilyName>UNKNOWN</FamilyName>
                </Alphabetic>
              </PersonName>
            </DicomAttribute>
          </xsl:otherwise>
        </xsl:choose>
        <!-- Verifying Observer Identification Code Sequence -->
        <DicomAttribute tag="0040A088" vr="SQ"/>
      </Item>
    </DicomAttribute>
    <xsl:variable name="resultStatus" select="normalize-space(field[25])"/>
    <!--Completion Flag-->
    <xsl:variable name="completionFlag">
      <xsl:choose>
        <xsl:when test="$resultStatus='P'">
          <xsl:value-of select="'PARTIAL'"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="'COMPLETE'"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0040A491'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="$completionFlag"/>
    </xsl:call-template>
    <!--Verification Flag-->
    <xsl:variable name="verificationFlag">
      <xsl:choose>
        <xsl:when test="$resultStatus='P' or $resultStatus='F'">
          <xsl:value-of select="'VERIFIED'"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="'UNVERIFIED'"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'0040A493'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val" select="$verificationFlag"/>
    </xsl:call-template>
  </xsl:template>
  <xsl:template name="const-obsctx">
    <Item number="1">
      <!--Relationship Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A010'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'HAS CONCEPT MOD'"/>
      </xsl:call-template>
      <!--Value Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A040'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'CODE'"/>
      </xsl:call-template>
      <!--Concept Name Code Sequence-->
      <xsl:call-template name="codeItem">
        <xsl:with-param name="sqtag" select="'0040A043'"/>
        <xsl:with-param name="code" select="'121049'"/>
        <xsl:with-param name="scheme" select="'DCM'"/>
        <xsl:with-param name="meaning" select="'Language of Content Item and Descendants'"/>
      </xsl:call-template>
      <!--Concept Code Sequence-->
      <xsl:call-template name="codeItem">
        <xsl:with-param name="sqtag" select="'0040A168'"/>
        <xsl:with-param name="code" select="$langCodeValue"/>
        <xsl:with-param name="scheme" select="$langCodingSchemeDesignator"/>
        <xsl:with-param name="meaning" select="$langCodeMeaning"/>
      </xsl:call-template>
    </Item>
  </xsl:template>
  <xsl:template match="OBR" mode="obsctx">
    <xsl:if test="field[32]">
      <Item number="1">
        <!--Relationship Type-->
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'0040A010'"/>
          <xsl:with-param name="vr" select="'CS'"/>
          <xsl:with-param name="val" select="'HAS OBS CONTEXT'"/>
        </xsl:call-template>
        <!--Value Type-->
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'0040A040'"/>
          <xsl:with-param name="vr" select="'CS'"/>
          <xsl:with-param name="val" select="'PNAME'"/>
        </xsl:call-template>
        <!--Concept Name Code Sequence-->
        <xsl:call-template name="codeItem">
          <xsl:with-param name="sqtag" select="'0040A043'"/>
          <xsl:with-param name="code" select="'121008'"/>
          <xsl:with-param name="scheme" select="'DCM'"/>
          <xsl:with-param name="meaning" select="'Person Observer Name'"/>
        </xsl:call-template>
        <!--Person Name-->
        <xsl:call-template name="cnn2pnAttr">
          <xsl:with-param name="tag" select="'0040A123'"/>
          <xsl:with-param name="cn" select="field[32]"/>
        </xsl:call-template>
      </Item>
    </xsl:if>
    <Item number="1">
      <!--Relationship Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A010'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'HAS OBS CONTEXT'"/>
      </xsl:call-template>
      <!--Value Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A040'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'CODE'"/>
      </xsl:call-template>
      <!--Concept Name Code Sequence-->
      <xsl:call-template name="codeItem">
        <xsl:with-param name="sqtag" select="'0040A043'"/>
        <xsl:with-param name="code" select="'121023'"/>
        <xsl:with-param name="scheme" select="'DCM'"/>
        <xsl:with-param name="meaning" select="'Procedure Code'"/>
      </xsl:call-template>
      <!--Concept Code Sequence-->
      <xsl:call-template name="ce2codeItem">
        <xsl:with-param name="seqTag" select="'0040A168'"/>
        <xsl:with-param name="codedEntry" select="field[4]"/>
      </xsl:call-template>
    </Item>
  </xsl:template>

  <xsl:template match="OBX" mode="img">
    <Item number="1">
      <!--Referenced SOP Sequence-->
      <DicomAttribute tag="00081199" vr="SQ">
        <Item number="1">
          <!--Referenced SOP Class UID-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'00081150'"/>
            <xsl:with-param name="vr" select="'UI'"/>
            <xsl:with-param name="val" select="following-sibling::*[1]/field[5]"/>
          </xsl:call-template>
          <!--Referenced SOP Instance UID-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'00081155'"/>
            <xsl:with-param name="vr" select="'UI'"/>
            <xsl:with-param name="val" select="field[5]"/>
          </xsl:call-template>
        </Item>
      </DicomAttribute>
      <!--Relationship Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A010'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'CONTAINS'"/>
      </xsl:call-template>
      <!--Value Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A040'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'IMAGE'"/>
      </xsl:call-template>
    </Item>
  </xsl:template>

  <xsl:template match="OBX" mode="rad128">
    <xsl:variable name="valueType" select="field[2]"/>
    <xsl:variable name="observationID" select="field[3]"/>

    <Item number="1">
      <!--Relationship Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A010'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'CONTAINS'"/>
      </xsl:call-template>
      <!--Value Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A040'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'CONTAINER'"/>
      </xsl:call-template>
      <!--Concept Name Code Sequence-->
      <xsl:call-template name="ce2codeItem">
        <xsl:with-param name="seqTag" select="'0040A043'"/>
        <xsl:with-param name="codedEntry" select="$observationID"/>
      </xsl:call-template>
      <!--Continuity Of Content-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A050'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'SEPARATE'"/>
      </xsl:call-template>
      <!--Content Sequence-->
      <DicomAttribute tag="0040A730" vr="SQ">
        <Item number="1">
          <!--Relationship Type-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'0040A010'"/>
            <xsl:with-param name="vr" select="'CS'"/>
            <xsl:with-param name="val" select="'CONTAINS'"/>
          </xsl:call-template>
          <!--Value Type-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'0040A040'"/>
            <xsl:with-param name="vr" select="'CS'"/>
            <xsl:with-param name="val">
              <xsl:choose>
                <xsl:when test="$valueType = 'TX'">
                  <xsl:value-of select="'TEXT'"/>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:value-of select="'CODE'"/>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:with-param>
          </xsl:call-template>
          <!--Concept Name Code Sequence-->
          <xsl:call-template name="ce2codeItem">
            <xsl:with-param name="seqTag" select="'0040A043'"/>
            <xsl:with-param name="codedEntry" select="$observationID"/>
          </xsl:call-template>
          <xsl:choose>
            <xsl:when test="$valueType = 'TX'">
              <!--Text Value-->
              <xsl:call-template name="attr">
                <xsl:with-param name="tag" select="'0040A160'"/>
                <xsl:with-param name="vr" select="'UT'"/>
                <xsl:with-param name="val">
                  <xsl:apply-templates select="field[5]" mode="txt"/>
                </xsl:with-param>
              </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
              <!--Concept Code Sequence-->
              <xsl:call-template name="ce2codeItem">
                <xsl:with-param name="seqTag" select="'0040A168'"/>
                <xsl:with-param name="codedEntry" select="field[5]"/>
              </xsl:call-template>
            </xsl:otherwise>
          </xsl:choose>
        </Item>
      </DicomAttribute>
    </Item>
  </xsl:template>

  <xsl:template match="OBX" mode="txt">
    <xsl:variable name="text">
      <xsl:apply-templates select="field[5]" mode="txt"/>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="starts-with($text, 'History')">
        <xsl:call-template name="text">
          <xsl:with-param name="hcode" select="'121060'"/>
          <xsl:with-param name="hname" select="'History'"/>
          <xsl:with-param name="ecode" select="'121060'"/>
          <xsl:with-param name="ename" select="'History'"/>
          <xsl:with-param name="text" select="substring($text,9)"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="starts-with($text, 'Findings')">
        <xsl:call-template name="text">
          <xsl:with-param name="hcode" select="'121070'"/>
          <xsl:with-param name="hname" select="'Findings'"/>
          <xsl:with-param name="ecode" select="'121071'"/>
          <xsl:with-param name="ename" select="'Finding'"/>
          <xsl:with-param name="text" select="substring($text,10)"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="starts-with($text, 'Conclusions')">
        <xsl:call-template name="text">
          <xsl:with-param name="hcode" select="'121076'"/>
          <xsl:with-param name="hname" select="'Conclusions'"/>
          <xsl:with-param name="ecode" select="'121077'"/>
          <xsl:with-param name="ename" select="'Conclusion'"/>
          <xsl:with-param name="text" select="substring($text,13)"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="text">
          <xsl:with-param name="text" select="$text"/>
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="text">
    <xsl:param name="hcode" select="'121070'"/>
    <xsl:param name="hname" select="'Findings'"/>
    <xsl:param name="ecode" select="'121071'"/>
    <xsl:param name="ename" select="'Finding'"/>
    <xsl:param name="text"/>
    <Item number="1">
      <!--Relationship Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A010'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'CONTAINS'"/>
      </xsl:call-template>
      <!--Value Type-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A040'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'CONTAINER'"/>
      </xsl:call-template>
      <!--Concept Name Code Sequence-->
      <xsl:call-template name="codeItem">
        <xsl:with-param name="sqtag" select="'0040A043'"/>
        <xsl:with-param name="code" select="$hcode"/>
        <xsl:with-param name="scheme" select="'DCM'"/>
        <xsl:with-param name="meaning" select="$hname"/>
      </xsl:call-template>
      <!--Continuity Of Content-->
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'0040A050'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="'SEPARATE'"/>
      </xsl:call-template>
      <!--Content Sequence-->
      <DicomAttribute tag="0040A730" vr="SQ">
        <Item number="1">
          <!--Relationship Type-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'0040A010'"/>
            <xsl:with-param name="vr" select="'CS'"/>
            <xsl:with-param name="val" select="'CONTAINS'"/>
          </xsl:call-template>
          <!--Value Type-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'0040A040'"/>
            <xsl:with-param name="vr" select="'CS'"/>
            <xsl:with-param name="val" select="'TEXT'"/>
          </xsl:call-template>
          <!--Concept Name Code Sequence-->
          <xsl:call-template name="codeItem">
            <xsl:with-param name="sqtag" select="'0040A043'"/>
            <xsl:with-param name="code" select="$ecode"/>
            <xsl:with-param name="scheme" select="'DCM'"/>
            <xsl:with-param name="meaning" select="$ename"/>
          </xsl:call-template>
          <!--Text Value-->
          <xsl:call-template name="attr">
            <xsl:with-param name="tag" select="'0040A160'"/>
            <xsl:with-param name="vr" select="'UT'"/>
            <xsl:with-param name="val" select="$text"/>
          </xsl:call-template>
        </Item>
      </DicomAttribute>
    </Item>
  </xsl:template>

  <xsl:template name="ed">
    <xsl:variable name="obx5" select="OBX/field[5]"/>
    <xsl:variable name="mimeType">
      <xsl:choose>
        <xsl:when test="$obx5/component[1] = 'Application' and $obx5/component[2] = 'PDF' and $obx5/component[3] = 'Base64'">
          <xsl:value-of select="'application/pdf'"/>
        </xsl:when>
        <xsl:when test="$obx5/component[1] = 'Text' and $obx5/component[2] = 'text/xml' and $obx5/component[3] = 'A'">
          <xsl:value-of select="'text/xml'"/>
        </xsl:when>
        <xsl:otherwise/>
      </xsl:choose>
    </xsl:variable>
    <xsl:if test="$mimeType and string-length($mimeType) > 0">
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'00420012'"/>
        <xsl:with-param name="vr" select="'LO'"/>
        <xsl:with-param name="val" select="$mimeType"/>
      </xsl:call-template>
    </xsl:if>
    <xsl:call-template name="ed-const-attrs">
      <xsl:with-param name="mimeType" select="$mimeType"/>
    </xsl:call-template>
    <xsl:choose>
      <xsl:when test="$mimeType = 'text/xml'">
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'0040A160'"/>
          <xsl:with-param name="vr" select="'UT'"/>
          <xsl:with-param name="val" select="$obx5/component[4]"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="$mimeType = 'application/pdf'">
        <DicomAttribute tag="00420011" vr="OB">
          <InlineBinary>
            <xsl:value-of select="$obx5/component[4]"/>
          </InlineBinary>
        </DicomAttribute>
      </xsl:when>
      <xsl:otherwise/>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
