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
    return { OpenMultipleQuoteDialog: openMultipleQuoteDialog };
})();