/*
 * **** BEGIN LICENSE BLOCK *****
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
 * Portions created by the Initial Developer are Copyright (C) 2015-2019
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
 * **** END LICENSE BLOCK *****
 *
 */

package org.dcm4chee.arc.wado;

import org.dcm4che3.ws.rs.MediaTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.StreamingOutput;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Aug 2019
 */
public class ThumbnailOutput implements StreamingOutput {

    private static final Logger LOG = LoggerFactory.getLogger(ThumbnailOutput.class);

    private final File file;
    private final int rows;
    private final int columns;
    private final ImageWriter writer;
    private final MediaType mediaType;

    public ThumbnailOutput(File file, int rows, int columns, MediaType mediaType) {
        this.file = file;
        this.rows = rows;
        this.columns = columns;
        this.writer = RenderedImageOutput.getImageWriter(mediaType);
        this.mediaType = mediaType;
    }

    @Override
    public void write(OutputStream out) throws IOException, WebApplicationException {
        LOG.debug("Start writing thumbnail {}", file);
        BufferedImage bi = ImageIO.read(file);
        if (bi.getHeight() != rows || bi.getWidth() != columns)
            bi = RenderedImageOutput.rescale(bi, rows, columns, 1.f);
        if (mediaType.equals(MediaTypes.IMAGE_JPEG_TYPE))
            bi = toRGB(bi);
        try (ImageOutputStream imageOut = new MemoryCacheImageOutputStream(out)) {
            writer.setOutput(imageOut);
            LOG.debug("Start writing thumbnail {}", file.getName());
            writer.write(new IIOImage(bi, null, null));
            LOG.debug("Finished writing thumbnail {}", file.getName());
        } finally {
            writer.dispose();
        }
    }

    private static BufferedImage toRGB(BufferedImage src) {
        BufferedImage dest = new BufferedImage(
                src.getWidth(),
                src.getHeight(),
                BufferedImage.TYPE_INT_RGB);
        dest.createGraphics().drawImage(src, 0, 0, Color.WHITE, null);
        return dest;
    }
}
