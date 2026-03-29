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

    async function submitForApproval(formContext) {
        const hasSalesManagerRole = userHasRole("Sales Manager");
        if (!hasSalesManagerRole) return;

        const confirmed = await confirmDialog(
            "Submit for Approval",
            "Send for approval?"
        );
        if (!confirmed) return;

        Xrm.Utility.showProgressIndicator("Submitting for approval...");
        try {
            const opportunityId = formContext.data.entity.getId().slice(1, -1);
            const globalContext = Xrm.Utility.getGlobalContext();

            await fetch(
                `${globalContext.getClientUrl()}/api/data/v9.2/opportunities(${opportunityId})/Microsoft.Dynamics.CRM.dc_SubmitOpportunityForApproval`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0"
                    },
                    body: JSON.stringify({})
                }
            );

            await formContext.data.refresh(false);
        } catch (error) {
            console.error("Navco: Error in submitForApproval.", error.message);
            Xrm.Navigation.openErrorDialog({ message: error.message });
        } finally {
            Xrm.Utility.closeProgressIndicator();
        }
    }

    return {
        OpenMultipleQuoteDialog: openMultipleQuoteDialog,
        SubmitForApproval: submitForApproval
    };
})();

function userHasRole(roleName) {
    const roles = Xrm.Utility.getGlobalContext().userSettings.roles;
    let found = false;
    roles.forEach(role => { if (role.name === roleName) found = true; });
    return found;
}

async function confirmDialog(title, text) {
    const result = await Xrm.Navigation.openConfirmDialog({ title, text }, { height: 200, width: 450 });
    return result.confirmed;
}
