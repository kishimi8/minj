package org.dcm4chee.arc.event;

import org.dcm4chee.arc.entity.Task;

import javax.servlet.http.HttpServletRequest;

/**
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @author Gunter Zeilinger <gunterze@protonmail.com>
 * @since Jan 2018
 */

public class TaskEvent {
    private final HttpServletRequest request;
    private final TaskOperation operation;
    private Task task;
    private Exception exception;

    public TaskEvent(HttpServletRequest request, TaskOperation operation) {
        this.request = request;
        this.operation = operation;
        this.task = task;
    }

    public HttpServletRequest getRequest() {
        return request;
    }

    public TaskOperation getOperation() {
        return operation;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Exception getException() {
        return exception;
    }

    public void setException(Exception exception) {
        this.exception = exception;
    }
}
