var NavcoSdk = window.NavcoSdk || {};
(function () {

    /**
     * -----------------------------------------------------------------------------------------------------------------------
     * *************************************************** Event Handlers ***************************************************
     * -----------------------------------------------------------------------------------------------------------------------
     */

    // Code to run in the form OnLoad event
    this.formOnLoad = function (executionContext) {
        var formContext = executionContext.getFormContext();

        if (formContext.ui.getFormType() === 1) {
            formContext.getControl('dc_completiondate')?.setVisible(false);
            formContext.getControl('dc_technicianid')?.setVisible(false);
        }
    };

    // Code to run when dc_workordertype field changes
    this.onWorkOrderTypeChange = function (executionContext) {
        var formContext = executionContext.getFormContext();

        var workOrderType = formContext.getAttribute('dc_workordertype').getValue();

        if (workOrderType === 100000001) { // Emergency
            formContext.getAttribute('dc_priority').setRequiredLevel('required');
            formContext.getControl('dc_escalationreason')?.setVisible(true);
        } else {
            formContext.getAttribute('dc_priority').setRequiredLevel('recommended');
            formContext.getControl('dc_escalationreason')?.setVisible(false);
        }
    };

}).call(NavcoSdk);
