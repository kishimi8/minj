<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:param name="hl7CharacterSet"/>

  <xsl:template name="attr">
    <xsl:param name="tag"/>
    <xsl:param name="vr"/>
    <xsl:param name="val"/>
    <xsl:if test="$val">
      <DicomAttribute tag="{$tag}" vr="{$vr}">
        <xsl:if test="$val != '&quot;&quot;'">
          <Value number="1">
            <xsl:value-of select="$val"/>
          </Value>
        </xsl:if>
      </DicomAttribute>
    </xsl:if>
  </xsl:template>

  <xsl:template name="sex">
    <xsl:param name="val"/>
    <xsl:if test="$val">
      <xsl:choose>
        <xsl:when test="$val = 'F' or $val = 'M' or $val = 'O'">
          <xsl:value-of select="$val"/>
        </xsl:when>
        <xsl:when test="$val = 'A' or $val = 'N'">O</xsl:when>
        <xsl:otherwise>&quot;&quot;</xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>

  <xsl:template name="neutered">
    <xsl:param name="val"/>
    <xsl:choose>
      <xsl:when test="$val = 'Y'">ALTERED</xsl:when>
      <xsl:when test="$val = 'N'">UNALTERED</xsl:when>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="pnComp">
    <xsl:param name="name"/>
    <xsl:param name="val"/>
    <xsl:if test="$val and $val != '&quot;&quot;'">
      <xsl:element name="{$name}">
        <xsl:value-of select="$val"/>
      </xsl:element>
    </xsl:if>
  </xsl:template>

  <xsl:template name="concat">
    <xsl:param name="val1"/>
    <xsl:param name="val2"/>
    <xsl:choose>
      <xsl:when test="not ($val1 and $val1 != '&quot;&quot;')">
        <xsl:value-of select="$val2"/>
      </xsl:when>
      <xsl:when test="not ($val2 and $val2 != '&quot;&quot;')">
        <xsl:value-of select="$val1"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="concat($val1,' ',$val2)"/>
      </xsl:otherwise>
    </xsl:choose>
   </xsl:template>

  <xsl:template name="pnAttr">
    <xsl:param name="tag"/>
    <xsl:param name="val"/>
    <xsl:param name="fn"/>
    <xsl:param name="gn"/>
    <xsl:param name="mn"/>
    <xsl:param name="np"/>
    <xsl:param name="ns"/>
    <xsl:param name="deg"/>
    <xsl:if test="$val">
      <DicomAttribute tag="{$tag}" vr="PN">
        <xsl:if test="$val != '&quot;&quot;'">
          <PersonName number="1">
            <Alphabetic>
              <xsl:call-template name="pnComp">
                <xsl:with-param name="name">FamilyName</xsl:with-param>
                <xsl:with-param name="val" select="$fn"/>
              </xsl:call-template>
              <xsl:call-template name="pnComp">
                <xsl:with-param name="name">GivenName</xsl:with-param>
                <xsl:with-param name="val" select="$gn"/>
              </xsl:call-template>
              <xsl:call-template name="pnComp">
                <xsl:with-param name="name">MiddleName</xsl:with-param>
                <xsl:with-param name="val" select="$mn"/>
              </xsl:call-template>
              <xsl:call-template name="pnComp">
                <xsl:with-param name="name">NamePrefix</xsl:with-param>
                <xsl:with-param name="val" select="$np"/>
              </xsl:call-template>
              <xsl:call-template name="pnComp">
                <xsl:with-param name="name">NameSuffix</xsl:with-param>
                <xsl:with-param name="val">
                  <xsl:call-template name="concat">
                    <xsl:with-param name="val1" select="$ns"/>
                    <xsl:with-param name="val2" select="$deg"/>
                  </xsl:call-template>
                </xsl:with-param>
              </xsl:call-template>
            </Alphabetic>
          </PersonName>
        </xsl:if>
      </DicomAttribute>
    </xsl:if>
  </xsl:template>

  <xsl:template name="vetPID2attr">
    <xsl:param name="chip"/>
    <xsl:param name="tattoo"/>
    <xsl:if test="$chip/text() or $tattoo/text()">
      <DicomAttribute tag="00101002" vr="SQ">
        <xsl:if test="not(contains($chip/text(), '&quot;&quot;')) and string-length($chip/text())>0">
          <xsl:call-template name="pidItem">
            <xsl:with-param name="itemNo" select="'1'"/>
            <xsl:with-param name="cx" select="$chip"/>
            <xsl:with-param name="default-pid-issuer" select="'CHIP'"/>
            <xsl:with-param name="pid-type" select="'RFID'"/>
          </xsl:call-template>
        </xsl:if>
        <xsl:if test="not(contains($tattoo/text(), '&quot;&quot;')) and string-length($tattoo/text())>0">
          <xsl:call-template name="pidItem">
            <xsl:with-param name="itemNo">
              <xsl:choose>
                <xsl:when test="$chip/text()">
                  <xsl:value-of select="'2'"/>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:value-of select="'1'"/>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:with-param>
            <xsl:with-param name="cx" select="$tattoo"/>
            <xsl:with-param name="default-pid-issuer" select="'TATTOO'"/>
            <xsl:with-param name="pid-type" select="'BARCODE'"/>
          </xsl:call-template>
        </xsl:if>
      </DicomAttribute>
    </xsl:if>
  </xsl:template>

  <xsl:template name="cx2pidAttrs">
    <xsl:param name="cx"/>
    <DicomAttribute tag="00100020" vr="LO">
      <Value number="1">
        <xsl:value-of select="$cx/text()"/>
      </Value>
    </DicomAttribute>
    <xsl:variable name="hd" select="$cx/component[3]" />
    <xsl:if test="$hd">
      <DicomAttribute tag="00100021" vr="LO">
        <Value number="1">
          <xsl:value-of select="$hd/text()"/>
        </Value>
      </DicomAttribute>
      <xsl:if test="$hd/subcomponent[2]">
        <DicomAttribute tag="00100024" vr="SQ">
          <Item number="1">
            <DicomAttribute tag="00400032" vr="UT">
              <Value number="1">
                <xsl:value-of select="$hd/subcomponent[1]"/>
              </Value>
            </DicomAttribute>
            <DicomAttribute tag="00400033" vr="CS">
              <Value number="1">
                <xsl:value-of select="$hd/subcomponent[2]"/>
              </Value>
            </DicomAttribute>
          </Item>
        </DicomAttribute>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template name="xpn2pnAttr">
    <xsl:param name="tag"/>
    <xsl:param name="xpn"/>
    <xsl:param name="xpn25" select="$xpn/component"/>
    <xsl:variable name="val">
      <xsl:apply-templates select="$xpn" mode="txt"/>
    </xsl:variable>
    <xsl:variable name="gn">
      <xsl:apply-templates select="$xpn25[1]" mode="txt"/>
    </xsl:variable>
    <xsl:call-template name="pnAttr">
      <xsl:with-param name="tag" select="$tag"/>
      <xsl:with-param name="val">
        <xsl:value-of select="$val"/>
      </xsl:with-param>
      <xsl:with-param name="fn">
        <xsl:choose>
          <xsl:when test="string-length($gn) != 0">
            <xsl:value-of select="substring-before($val, $gn)"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="$val"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:with-param>
      <xsl:with-param name="gn">
        <xsl:value-of select="$gn"/>
      </xsl:with-param>
      <xsl:with-param name="mn">
        <xsl:apply-templates select="$xpn25[2]" mode="txt"/>
      </xsl:with-param>
      <xsl:with-param name="ns">
        <xsl:apply-templates select="$xpn25[3]" mode="txt"/>
      </xsl:with-param>
      <xsl:with-param name="np">
        <xsl:apply-templates select="$xpn25[4]" mode="txt"/>
      </xsl:with-param>
      <xsl:with-param name="deg">
        <xsl:apply-templates select="$xpn25[5]" mode="txt"/>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="cn2pnAttr">
    <xsl:param name="tag"/>
    <xsl:param name="cn"/>
    <xsl:param name="cn26" select="$cn/component"/>
    <xsl:if test="$cn26 or $cn = '&quot;&quot;'">
      <xsl:call-template name="pnAttr">
        <xsl:with-param name="tag" select="$tag"/>
        <xsl:with-param name="val" select="string($cn/text())"/>
        <xsl:with-param name="fn">
          <xsl:apply-templates select="$cn26[1]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="gn">
          <xsl:apply-templates select="$cn26[2]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="mn">
          <xsl:apply-templates select="$cn26[3]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="ns">
          <xsl:apply-templates select="$cn26[4]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="np">
          <xsl:apply-templates select="$cn26[5]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="deg">
          <xsl:apply-templates select="$cn26[6]" mode="txt"/>
        </xsl:with-param>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <xsl:template name="cnn2pnAttr">
    <xsl:param name="tag"/>
    <xsl:param name="cn"/>
    <xsl:if test="$cn or $cn != '&quot;&quot;'">
      <xsl:call-template name="pnAttr">
        <xsl:with-param name="tag" select="$tag"/>
        <xsl:with-param name="val" select="string($cn)"/>
        <xsl:with-param name="fn">
          <xsl:apply-templates select="$cn/subcomponent[1]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="gn">
          <xsl:apply-templates select="$cn/subcomponent[2]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="mn">
          <xsl:apply-templates select="$cn/subcomponent[3]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="ns">
          <xsl:apply-templates select="$cn/subcomponent[4]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="np">
          <xsl:apply-templates select="$cn/subcomponent[5]" mode="txt"/>
        </xsl:with-param>
        <xsl:with-param name="deg">
          <xsl:apply-templates select="$cn/subcomponent[6]" mode="txt"/>
        </xsl:with-param>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <xsl:template name="codeItem">
    <xsl:param name="sqtag"/>
    <xsl:param name="code"/>
    <xsl:param name="scheme"/>
    <xsl:param name="meaning"/>
    <xsl:if test="$code and $scheme and $meaning">
      <DicomAttribute tag="{$sqtag}" vr="SQ">
        <xsl:call-template name="codeItem1">
          <xsl:with-param name="itemNo" select="'1'"/>
          <xsl:with-param name="code" select="$code"/>
          <xsl:with-param name="scheme" select="$scheme"/>
          <xsl:with-param name="meaning" select="$meaning"/>
        </xsl:call-template>
      </DicomAttribute>
    </xsl:if>
  </xsl:template>

  <xsl:template name="codeItem1">
    <xsl:param name="itemNo"/>
    <xsl:param name="code"/>
    <xsl:param name="scheme"/>
    <xsl:param name="meaning"/>
    <xsl:if test="$code and $scheme and $meaning">
      <Item number="{$itemNo}">
        <!-- Code Value -->
        <xsl:call-template name="attr">
          <xsl:with-param name="val" select="substring($code,1,16)"/>
          <xsl:with-param name="vr" select="'SH'"/>
          <xsl:with-param name="tag" select="'00080100'"/>
        </xsl:call-template>
        <!-- Coding Scheme Designator -->
        <xsl:call-template name="attr">
          <xsl:with-param name="val" select="substring($scheme,1,16)"/>
          <xsl:with-param name="vr" select="'SH'"/>
          <xsl:with-param name="tag" select="'00080102'"/>
        </xsl:call-template>
        <!-- Code Meaning -->
        <xsl:call-template name="trimmedAttr">
          <xsl:with-param name="tag" select="'00080104'"/>
          <xsl:with-param name="vr" select="'LO'"/>
          <xsl:with-param name="val" select="$meaning"/>
        </xsl:call-template>
      </Item>
    </xsl:if>
  </xsl:template>

  <xsl:template name="ce2codeItem">
    <xsl:param name="seqTag"/>
    <xsl:param name="codedEntry"/>
    <xsl:param name="offset" select="0"/>
    <xsl:call-template name="codeItem">
      <xsl:with-param name="sqtag" select="$seqTag"/>
      <xsl:with-param name="code">
        <xsl:choose>
          <xsl:when test="$offset != 0"><xsl:value-of select="$codedEntry/component[$offset]"/></xsl:when>
          <xsl:otherwise><xsl:value-of select="$codedEntry/text()"/></xsl:otherwise>
        </xsl:choose>
      </xsl:with-param>
      <xsl:with-param name="scheme" select="$codedEntry/component[$offset+2]"/>
      <xsl:with-param name="meaning">
        <xsl:apply-templates select="$codedEntry/component[$offset+1]" mode="txt" />
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="ce2codeItemWithDesc">
    <xsl:param name="descTag"/>
    <xsl:param name="seqTag"/>
    <xsl:param name="codedEntry"/>
    <xsl:param name="offset" select="0"/>
    <xsl:variable name="desc" select="$codedEntry/component[$offset+1]"/>
    <xsl:call-template name="trimmedAttr">
      <xsl:with-param name="tag" select="$descTag"/>
      <xsl:with-param name="vr" select="'LO'"/>
      <xsl:with-param name="val">
        <xsl:call-template name="codeItemDesc">
          <xsl:with-param name="descVal" select="$desc"/>
          <xsl:with-param name="codedEntry" select="$codedEntry"/>
        </xsl:call-template>
      </xsl:with-param>
    </xsl:call-template>
    <xsl:call-template name="ce2codeItem">
      <xsl:with-param name="seqTag" select="$seqTag"/>
      <xsl:with-param name="codedEntry" select="$codedEntry"/>
      <xsl:with-param name="offset" select="$offset"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="codeItemDesc">
    <xsl:param name="descVal"/>
    <xsl:param name="codedEntry"/>
    <xsl:choose>
      <xsl:when test="$descVal and $descVal != '&quot;&quot;'">
        <xsl:apply-templates select="$descVal" mode="txt"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates select="$codedEntry" mode="txt"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="trimmedAttr">
    <xsl:param name="tag"/>
    <xsl:param name="vr"/>
    <xsl:param name="val"/>
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="$tag"/>
      <xsl:with-param name="vr" select="$vr"/>
      <xsl:with-param name="val" select="substring($val, 1, 64)"/>
    </xsl:call-template>
  </xsl:template>
  
  <xsl:template name="address">
    <xsl:param name="val"/>
    <xsl:variable name="streetAddr" select="$val/text()"/>
    <xsl:variable name="addrComponents">
      <xsl:for-each select="$val/component">
        <xsl:value-of select="." />
        <xsl:if test="position()!=last()">
          <xsl:value-of select="'^'"/>
        </xsl:if>
      </xsl:for-each>
    </xsl:variable>
    <xsl:if test="string-length($streetAddr) > 0 or string-length($addrComponents) > 0">
      <xsl:value-of select="concat($streetAddr, '^', $addrComponents)"/>
    </xsl:if>
  </xsl:template>

  <xsl:template match="PID">
    <!-- Patient Name -->
    <xsl:call-template name="xpn2pnAttr">
      <xsl:with-param name="tag" select="'00100010'"/>
      <xsl:with-param name="xpn" select="field[5]"/>
    </xsl:call-template>
    <!-- Patient ID -->
    <xsl:call-template name="cx2pidAttrs">
      <xsl:with-param name="cx" select="field[3]"/>
    </xsl:call-template>
    <!-- Patient Birth Date -->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00100030'"/>
      <xsl:with-param name="vr" select="'DA'"/>
      <xsl:with-param name="val" select="substring(field[7],1,8)"/>
    </xsl:call-template>
    <!-- Patient's Address' -->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00101040'"/>
      <xsl:with-param name="vr" select="'LO'"/>
      <xsl:with-param name="val">
        <xsl:call-template name="address">
          <xsl:with-param name="val" select="field[11]"/>
        </xsl:call-template>
      </xsl:with-param>
    </xsl:call-template>
    <!-- Patient Sex -->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00100040'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val">
        <xsl:call-template name="sex">
          <xsl:with-param name="val" select="field[8]/text()"/>
        </xsl:call-template>
      </xsl:with-param>
    </xsl:call-template>
    <!-- Patient's Mother's Birth Name -->
    <xsl:call-template name="xpn2pnAttr">
      <xsl:with-param name="tag" select="'00101060'"/>
      <xsl:with-param name="xpn" select="field[6]"/>
    </xsl:call-template>
    <!-- Other Patient IDs Sequence -->
    <xsl:call-template name="vetPID2attr">
      <xsl:with-param name="chip" select="field[2]" />
      <xsl:with-param name="tattoo" select="field[4]" />
    </xsl:call-template>
    <xsl:variable name="owner" select="field[9]"/>
    <xsl:if test="$owner/text()">
      <!-- Responsible Person -->
      <xsl:call-template name="xpn2pnAttr">
        <xsl:with-param name="tag" select="'00102297'"/>
        <xsl:with-param name="xpn" select="$owner"/>
      </xsl:call-template>
      <!-- Responsible Person Role -->
      <xsl:variable name="ownerRole">
        <xsl:call-template name="nullifyIfAbsent">
          <xsl:with-param name="val" select="$owner/text()"/>
          <xsl:with-param name="defaultVal" select="'OWNER'" />
        </xsl:call-template>
      </xsl:variable>
      <xsl:call-template name="attr">
        <xsl:with-param name="tag" select="'00102298'"/>
        <xsl:with-param name="vr" select="'CS'"/>
        <xsl:with-param name="val" select="$ownerRole"/>
      </xsl:call-template>
    </xsl:if>
    <!-- Patient Species Description and Code Sequence -->
    <xsl:call-template name="ce2codeItemWithDesc">
      <xsl:with-param name="descTag" select="'00102201'"/>
      <xsl:with-param name="seqTag" select="'00102202'"/>
      <xsl:with-param name="codedEntry" select="field[35]"/>
    </xsl:call-template>
    <!-- Patient Breed Description and Code Sequence -->
    <xsl:call-template name="ce2codeItemWithDesc">
      <xsl:with-param name="descTag" select="'00102292'"/>
      <xsl:with-param name="seqTag" select="'00102293'"/>
      <xsl:with-param name="codedEntry" select="field[36]"/>
    </xsl:call-template>
    <!-- Patient's Sex Neutered -->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00102203'"/>
      <xsl:with-param name="vr" select="'CS'"/>
      <xsl:with-param name="val">
        <xsl:call-template name="neutered">
          <xsl:with-param name="val" select="field[8]/component/text()"/>
        </xsl:call-template>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="nullifyIfAbsent">
    <xsl:param name="val" />
    <xsl:param name="defaultVal" />
    <xsl:choose>
      <xsl:when test="not(contains($val, '&quot;&quot;'))">
        <xsl:value-of select="$defaultVal" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$val" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="pidItem">
    <xsl:param name="itemNo"/>
    <xsl:param name="cx"/>
    <xsl:param name="default-pid-issuer"/>
    <xsl:param name="pid-type"/>
      <Item number="{$itemNo}">
        <!-- Patient ID -->
        <xsl:call-template name="cx2pidAttrs">
          <xsl:with-param name="cx" select="$cx"/>
        </xsl:call-template>
        <xsl:if test="not($cx/component[3])">
          <!-- Type of Patient ID -->
          <DicomAttribute tag="00100021" vr="LO">
            <Value number="1">
              <xsl:value-of select="$default-pid-issuer"/>
            </Value>
          </DicomAttribute>
        </xsl:if>
        <!-- Type of Patient ID -->
        <DicomAttribute tag="00100022" vr="CS">
          <Value number="1">
            <xsl:value-of select="$pid-type"/>
          </Value>
        </DicomAttribute>
      </Item>
  </xsl:template>

  <xsl:template match="MRG">
    <!-- Modified Attributes Sequence -->
    <DicomAttribute tag="04000550" vr="SQ">
      <Item number="1">
        <!-- Patient Name -->
        <xsl:call-template name="xpn2pnAttr">
            <xsl:with-param name="tag" select="'00100010'"/>
            <xsl:with-param name="xpn" select="field[7]"/>
        </xsl:call-template>
        <!-- Patient ID -->
        <xsl:call-template name="cx2pidAttrs">
            <xsl:with-param name="cx" select="field[1]"/>
        </xsl:call-template>
      </Item>
    </DicomAttribute>
  </xsl:template>
  <xsl:template name="ei2attr">
    <xsl:param name="tag"/>
    <xsl:param name="vr"/>
    <xsl:param name="sqtag"/>
    <xsl:param name="ei"/>
    <xsl:variable name="val" select="$ei/text()"/>
    <xsl:if test="$val">
      <DicomAttribute tag="{$tag}" vr="{$vr}">
        <xsl:if test="$val != '&quot;&quot;'">
          <Value number="1">
            <xsl:value-of select="$val"/>
          </Value>
        </xsl:if>
      </DicomAttribute>
      <xsl:if test="$ei/component and $val != '&quot;&quot;'">
        <DicomAttribute tag="{$sqtag}" vr="SQ">
            <Item number="1">
                <xsl:if test="$ei/component[1]">
                  <DicomAttribute tag="00400031" vr="UT">
                    <Value number="1">
                      <xsl:value-of select="$ei/component[1]/text()"/>
                    </Value>
                  </DicomAttribute>
                </xsl:if>
                <xsl:if test="$ei/component[2] and $ei/component[3]">
                  <DicomAttribute tag="00400032" vr="UT">
                    <Value number="1">
                      <xsl:value-of select="$ei/component[2]/text()"/>
                    </Value>
                  </DicomAttribute>
                  <DicomAttribute tag="00400033" vr="CS">
                    <Value number="1">
                      <xsl:value-of select="$ei/component[3]/text()"/>
                    </Value>
                  </DicomAttribute>
                </xsl:if>
            </Item>
        </DicomAttribute>
      </xsl:if>
    </xsl:if>
  </xsl:template>
  <xsl:template name="attrDATM">
    <xsl:param name="datag"/>
    <xsl:param name="tmtag"/>
    <xsl:param name="val"/>
    <xsl:variable name="str" select="normalize-space($val)" />
    <xsl:if test="$str">
      <DicomAttribute tag="{$datag}" vr="DA">
        <Value number="1">
        <xsl:if test="$str != '&quot;&quot;'">
          <xsl:value-of select="substring($str,1,8)" />
        </xsl:if>
        </Value>
      </DicomAttribute>
      <DicomAttribute tag="{$tmtag}" vr="TM">
        <Value number="1">
        <xsl:if test="$str != '&quot;&quot;'">
          <xsl:variable name="tm" select="substring($str,9)"/>
          <!-- Skip Time Zone-->
          <xsl:variable name="tm_plus" select="substring-before($tm,'+')"/>
          <xsl:variable name="tm_minus" select="substring-before($tm,'-')"/>
          <xsl:choose>
            <xsl:when test="$tm_plus">
              <xsl:value-of select="$tm_plus"/>
            </xsl:when>
            <xsl:when test="$tm_minus">
              <xsl:value-of select="$tm_minus"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="$tm"/>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:if>
        </Value>
      </DicomAttribute>
    </xsl:if>
  </xsl:template>
  <xsl:template name="attrDT">
    <xsl:param name="dtTag"/>
    <xsl:param name="val"/>
    <xsl:variable name="str" select="normalize-space($val)" />
    <xsl:if test="$str">
      <DicomAttribute tag="{$dtTag}" vr="DT">
        <Value number="1">
          <xsl:if test="$str != '&quot;&quot;'">
            <xsl:value-of select="$str"/>
          </xsl:if>
        </Value>
      </DicomAttribute>
    </xsl:if>
  </xsl:template>

  <xsl:template match="PV1">
    <!-- Route of Admissions -->
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'00380016'"/>
      <xsl:with-param name="vr" select="'LO'"/>
      <xsl:with-param name="val" select="string(field[2]/text())"/>
    </xsl:call-template>
    <!-- Referring Physician Name -->
    <xsl:call-template name="cn2pnAttr">
      <xsl:with-param name="tag" select="'00080090'"/>
      <xsl:with-param name="cn" select="field[8]"/>
    </xsl:call-template>
    <xsl:call-template name="attr">
      <xsl:with-param name="tag" select="'001021C0'"/>
      <xsl:with-param name="vr" select="'US'"/>
      <xsl:with-param name="val">
        <xsl:call-template name="pregnancyStatus">
          <xsl:with-param name="ambulantStatus" select="field[15]/text()"/>
        </xsl:call-template>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template name="pregnancyStatus">
    <xsl:param name="ambulantStatus"/>
    <xsl:if test="$ambulantStatus">
      <xsl:choose>
        <xsl:when test="$ambulantStatus = 'B6'">3</xsl:when>
        <xsl:otherwise>&quot;&quot;</xsl:otherwise>
      </xsl:choose>
    </xsl:if>
  </xsl:template>

  <xsl:template name="admissionID">
    <xsl:param name="visitNumber"/>
    <xsl:param name="patientAccountNumber"/>
    <xsl:choose>
      <xsl:when test="$visitNumber and string-length($visitNumber/text()) > 0">
        <xsl:call-template name="entityIdentifier">
          <xsl:with-param name="ei" select="$visitNumber"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="entityIdentifier">
          <xsl:with-param name="ei" select="$patientAccountNumber"/>
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="entityIdentifier">
    <xsl:param name="ei"/>
    <xsl:variable name="val" select="$ei/text()"/>
    <xsl:if test="$val">
      <xsl:if test="$val != '&quot;&quot;'">
        <xsl:call-template name="attr">
          <xsl:with-param name="tag" select="'00380010'"/>
          <xsl:with-param name="vr" select="'LO'"/>
          <xsl:with-param name="val" select="$val"/>
        </xsl:call-template>
      </xsl:if>
      <xsl:if test="$ei/component and $val != '&quot;&quot;'">
        <DicomAttribute tag="00380014" vr="SQ">
          <Item number="1">
              <xsl:call-template name="attr">
                <xsl:with-param name="tag" select="'00400031'"/>
                <xsl:with-param name="vr" select="'UT'"/>
                <xsl:with-param name="val" select="$ei/component[3]/text()"/>
              </xsl:call-template>
              <xsl:call-template name="attr">
                <xsl:with-param name="tag" select="'00400032'"/>
                <xsl:with-param name="vr" select="'UT'"/>
                <xsl:with-param name="val" select="$ei/component[3]/subcomponent[1]"/>
              </xsl:call-template>
              <xsl:call-template name="attr">
                <xsl:with-param name="tag" select="'00400033'"/>
                <xsl:with-param name="vr" select="'CS'"/>
                <xsl:with-param name="val" select="$ei/component[3]/subcomponent[2]"/>
              </xsl:call-template>
          </Item>
        </DicomAttribute>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <xsl:template match="text()" mode="txt">
    <xsl:value-of select='.'/>
  </xsl:template>

  <xsl:template match="escape" mode="txt">
    <xsl:choose>
      <xsl:when test="text()='.br' or translate(text(), 'daA0', 'DDD')='XD'">
        <xsl:text>&#13;&#10;</xsl:text>
      </xsl:when>
      <xsl:when test="text()='F'">
        <xsl:text>|</xsl:text>
      </xsl:when>
      <xsl:when test="text()='S'">
        <xsl:text>^</xsl:text>
      </xsl:when>
      <xsl:when test="text()='T'">
        <xsl:text>&amp;</xsl:text>
      </xsl:when>
      <xsl:when test="text()='R'">
        <xsl:text>~</xsl:text>
      </xsl:when>
      <xsl:when test="text()='E'">
        <xsl:text>\\</xsl:text>
      </xsl:when>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
