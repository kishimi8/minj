package org.dcm4chee.arc.conf;

import javax.enterprise.util.AnnotationLiteral;
import javax.inject.Named;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @since Jul 2015
 */
public class NamedQualifier extends AnnotationLiteral<Named>  implements Named {
    private final String value;

    public NamedQualifier(String value) {
        this.value = value;
    }

    @Override
    public String value() {
        return value;
    }
}
