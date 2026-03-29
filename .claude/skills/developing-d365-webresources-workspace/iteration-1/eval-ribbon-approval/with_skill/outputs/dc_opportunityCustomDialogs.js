var DC = DC || {};

DC.OpportunityRibbon = (function () {
    function openMultipleQuoteDialog(formContext) {
        var opportunityId = formContext.data.entity.getId().slice(1, -1);
        var data = "opportunityId=" + opportunityId;

        var dialogParameters = {
            pageType: "webresource",
            webresourceName: "dc_/DCMultipleQuoteDialog/index.html",
            data: data
        };

        var navigationOptions = {
            target: 2,
            width: 450,
            height: 300,
            position: 1
        };

        Xrm.Navigation.navigateTo(dialogParameters, navigationOptions);
    }

    async function submitForApproval(formContext) {
        // Check role synchronously — preferred over a WebAPI call for role checks
        const roles = Xrm.Utility.getGlobalContext().userSettings.roles;
        let hasSalesManagerRole = false;
        roles.forEach(function (role) {
            if (role.name === "Sales Manager") hasSalesManagerRole = true;
        });

        if (!hasSalesManagerRole) {
            await Xrm.Navigation.openAlertDialog({ text: "You do not have the required 'Sales Manager' role to submit for approval." });
            return;
        }

        const confirmResult = await Xrm.Navigation.openConfirmDialog(
            { text: "Send for approval?", title: "Submit for Approval" },
            { height: 200, width: 450 }
        );
        if (!confirmResult.confirmed) return;

        const recordId = formContext.data.entity.getId().slice(1, -1);
        const clientUrl = Xrm.Utility.getGlobalContext().getClientUrl();

        Xrm.Utility.showProgressIndicator("Submitting for approval...");
        try {
            const response = await fetch(
                clientUrl + "/api/data/v9.2/opportunities(" + recordId + ")/Microsoft.Dynamics.CRM.dc_SubmitOpportunityForApproval",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                }
            );

            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(errorBody.error ? errorBody.error.message : "Request failed");
            }

            await formContext.data.refresh(false);

            const notifId = await Xrm.App.addGlobalNotification({ type: 2, level: 1, message: "Successfully submitted for approval." });
            setTimeout(function () { Xrm.App.clearGlobalNotification(notifId); }, 5000);
        } catch (error) {
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
