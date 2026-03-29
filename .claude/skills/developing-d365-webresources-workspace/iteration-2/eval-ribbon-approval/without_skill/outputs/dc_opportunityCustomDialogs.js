var DC = DC || {};

DC.OpportunityRibbon = (function () {
    function openMultipleQuoteDialog(formContext) {
        var opportunityId = formContext.data.entity.getId().slice(1, -1);
        var data = "opportunityId=" + opportunityId

        var dialogParameters = {
            pageType: "webresource",
            webresourceName: "dc_/DCMultipleQuoteDialog/index.html",
            data: data
        };

        var navigaitonOptions = {
            target: 2,
            width: 450,
            height: 300,
            position: 1
        };

        Xrm.Navigation.navigateTo(dialogParameters, navigaitonOptions).then(
            () => {
                formContext.ui.tabs.get("QUOTES").setFocus()
                formContext.ui.controls.get('quote').refresh()
                formContext.ui.setFormNotification("Multiple quotes generated successfully", "INFO", "MultipleQuotesGeneratedSuccessfully")

                setTimeout(() => {
                    formContext.ui.clearFormNotification("MultipleQuotesGeneratedSuccessfully")
                }, 5000)
            },
            (e) => {
                Xrm.Navigation.openErrorDialog(e);
            }
        );
    }

    function submitForApproval(formContext) {
        // Check if the current user has the 'Sales Manager' security role
        var userRoles = Xrm.Utility.getGlobalContext().userSettings.roles;
        var hasSalesManagerRole = false;

        userRoles.forEach(function (role) {
            if (role.name === "Sales Manager") {
                hasSalesManagerRole = true;
            }
        });

        if (!hasSalesManagerRole) {
            Xrm.Navigation.openAlertDialog({
                text: "You do not have the required 'Sales Manager' role to perform this action.",
                title: "Access Denied"
            });
            return;
        }

        // Open confirm dialog asking 'Send for approval?'
        var confirmStrings = {
            text: "Send for approval?",
            title: "Submit for Approval"
        };

        Xrm.Navigation.openConfirmDialog(confirmStrings).then(function (result) {
            if (result.confirmed) {
                var opportunityId = formContext.data.entity.getId().slice(1, -1);

                // Call the custom action dc_SubmitOpportunityForApproval bound to the opportunity record
                var actionRequest = {
                    entity: {
                        entityType: "opportunity",
                        id: opportunityId
                    },
                    getMetadata: function () {
                        return {
                            boundParameter: "entity",
                            parameterTypes: {},
                            operationType: 0,
                            operationName: "dc_SubmitOpportunityForApproval"
                        };
                    }
                };

                Xrm.WebApi.online.execute(actionRequest).then(
                    function () {
                        // Refresh the form after the action completes successfully
                        formContext.data.refresh(false);
                    },
                    function (error) {
                        Xrm.Navigation.openErrorDialog({ message: error.message });
                    }
                );
            }
        });
    }

    return {
        OpenMultipleQuoteDialog: openMultipleQuoteDialog,
        SubmitForApproval: submitForApproval
    };
})();
