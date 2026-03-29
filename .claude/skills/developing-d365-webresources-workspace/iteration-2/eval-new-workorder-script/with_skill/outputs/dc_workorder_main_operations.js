var NavcoWorkOrderSdk = window.NavcoWorkOrderSdk || {};
(function () {

    // --- Event Handlers (public) ---

    // Code to run in the form OnLoad event
    this.formOnLoad = function (executionContext) {
        const formContext = executionContext.getFormContext();
        initializeForm(formContext);
    };

    // Code to run when dc_workordertype field changes
    this.onWorkOrderTypeChange = function (executionContext) {
        const formContext = executionContext.getFormContext();
        handleWorkOrderTypeChange(formContext);
    };

    // --- Private Helpers ---

    function initializeForm(formContext) {
        if (formContext.ui.getFormType() === 1) { // Create
            formContext.getControl('dc_completiondate')?.setVisible(false);
            formContext.getControl('dc_technicianid')?.setVisible(false);
        }
    }

    function handleWorkOrderTypeChange(formContext) {
        const workOrderType = formContext.getAttribute('dc_workordertype')?.getValue();

        if (workOrderType === 100000001) { // Emergency
            formContext.getAttribute('dc_priority')?.setRequiredLevel('required');
            formContext.getControl('dc_escalationreason')?.setVisible(true);
        } else {
            formContext.getAttribute('dc_priority')?.setRequiredLevel('recommended');
            formContext.getControl('dc_escalationreason')?.setVisible(false);
        }
    }

}).call(NavcoWorkOrderSdk);
