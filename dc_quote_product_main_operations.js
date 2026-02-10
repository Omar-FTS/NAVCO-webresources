var Navco = window.Navco || {};
(function () {

    // Code to run in the form OnLoad event
    this.formOnLoad = function (executionContext) {
        const formContext = executionContext.getFormContext()

        lockFormWhenRelatedQuoteIsWonOrLost(formContext)
        lockFormWhenRelatedQuoteIsPendingApproval(formContext);

    }

    // check if given control is an ifrmae, webresource or a subgrid.
    function doesControlHaveAttribute(control) {
        var controlType = control.getControlType();
        return controlType != "iframe" && controlType != "webresource" && controlType != "subgrid";
    }

    async function lockFormWhenRelatedQuoteIsWonOrLost(formContext) {

        const relatedQuoteId = formContext.getAttribute("quoteid").getValue()[0].id.slice(1, -1)

        const globalContext = Xrm.Utility.getGlobalContext();
        const clientUrl = globalContext.getClientUrl();

        const fieldsToSkip = ['dc_recostingsequencenumber']

        const result = await fetch(`${clientUrl}/api/data/v9.2/quotes(${relatedQuoteId})?$select=statecode`)
            .then(response => response.json())

        // quote is active or won or lost
        if (result.statecode === 1 || result.statecode === 2 || result.statecode === 3) {
            formContext.ui.controls.forEach(function (control, _) {
                if (doesControlHaveAttribute(control) && !fieldsToSkip.includes(control.getAttribute().getName())) {
                    control.setDisabled(true);
                }
            });
        }

    }

     function lockFormWhenRelatedQuoteIsPendingApproval(formContext) {

        const PENDING_APPROVAL_STATUS = 948170001;
        const FORM_NOTIFICATION_ID = "lockedquote";
        const ERROR_MESSAGE = "Cannot edit lines on a quote pending approval.";

        const quoteAttr = formContext.getAttribute("dc_quoteid");

        if (!quoteAttr || !quoteAttr.getValue()) {
            return;
        }

        const quoteId = quoteAttr.getValue()[0].id.replace("{", "").replace("}", "");

        Xrm.WebApi.retrieveRecord("quote", quoteId, "?$select=statuscode")
            .then(
                function (result) {
                    if (result.statuscode === PENDING_APPROVAL_STATUS) {
                        applyPendingApprovalLock(formContext, ERROR_MESSAGE, FORM_NOTIFICATION_ID);
                    }
                },
                function (error) {
                    console.error("Navco: Failed to retrieve Quote status.", error.message);
                }
            );
    }

    function applyPendingApprovalLock(formContext, message, notificationId) {

        // Control notification
        const productControl = formContext.getControl("dc_productid");
        if (productControl) {
            productControl.setNotification(message);
        }

        // Form notification
        formContext.ui.setFormNotification(
            message,
            "ERROR",
            notificationId
        );

        // Disable fields
        disableFields(formContext, [
            "dc_productid",
            "productid",
            "baseamount",
            "dc_costoverride",
            "dc_priceoverride",
            "quantity"
        ]);
    }

    function disableFields(formContext, fields) {
        fields.forEach(function (fieldName) {
            const control = formContext.getControl(fieldName);
            if (control) {
                control.setDisabled(true);
            }
        });
    }

}).call(Navco)