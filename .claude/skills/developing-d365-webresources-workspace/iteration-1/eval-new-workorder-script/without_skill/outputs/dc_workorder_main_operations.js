var NavcoSdk = window.NavcoSdk || {};
(function () {

    // Code to run in the form OnLoad event
    this.formOnLoad = function (executionContext) {
        var formContext = executionContext.getFormContext();

        // On Create form, hide dc_completiondate and dc_technicianid
        if (formContext.ui.getFormType() == 1) {
            formContext.getControl('dc_completiondate')?.setVisible(false);
            formContext.getControl('dc_technicianid')?.setVisible(false);
        }
    }

    // Code to run on dc_workordertype field change
    this.onWorkOrderTypeChange = function (executionContext) {
        var formContext = executionContext.getFormContext();

        var EMERGENCY_TYPE = 100000001;

        var workOrderType = formContext.getAttribute('dc_workordertype').getValue();

        if (workOrderType === EMERGENCY_TYPE) {
            // Emergency: make dc_priority required and show dc_escalationreason
            formContext.getAttribute('dc_priority').setRequiredLevel('required');
            formContext.getControl('dc_escalationreason')?.setVisible(true);
        } else {
            // Non-Emergency: make dc_priority recommended and hide dc_escalationreason
            formContext.getAttribute('dc_priority').setRequiredLevel('recommended');
            formContext.getControl('dc_escalationreason')?.setVisible(false);
        }
    }

}).call(NavcoSdk);
