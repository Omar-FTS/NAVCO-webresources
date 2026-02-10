
var NavcoSdk = window.NavcoSdk || {};
(function () {


    /**
     * handler for clone button
     *
     * @param {*} formContext
     */
    this.getProductsfromOpportunity = function (formContext) {

        try {

            getProductsFromOpportunity(formContext)
        }
        finally {

            endProcess()

        }

    }

/**
 * Get Products from Opportunity to Quote
 * @param {*} formContext
 */
async function getProductsFromOpportunity(formContext) {
    try {
        const confirmStrings = {
            text: "Are you sure you want to get products from the opportunity?",
            title: "Get Products Confirmation"
        };
        const confirmOptions = {
            height: 200,
            width: 450
        };

        Xrm.Navigation.openConfirmDialog(confirmStrings, confirmOptions).then(
            async (success) => {
                if (!success.confirmed) {
                    return;
                }

                startProcess("Getting products from opportunity...");
                
                const currentQuoteId = formContext.data.entity.getId().slice(1, -1);
                
                const response = await fetch(`${getClientUrl()}/api/data/v9.2/quotes(${currentQuoteId})/Microsoft.Dynamics.CRM.dc_GetProductsfromOpportunity`, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify({
                        "QuoteId": currentQuoteId
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error.message || "Unknown error occurred while getting products.");
                }

                endProcess();
                
                // Refresh the form to show the newly created quote details
                formContext.data.refresh(true).then(
                    () => {
                        Xrm.Navigation.openAlertDialog({
                            text: "Products have been successfully retrieved from the opportunity!",
                            title: "Success"
                        });
                    }
                );
            }
        );
    } catch (error) {
        showError("Error getting products from opportunity", error);
    } finally {
        endProcess();
    }
}
  /**
     * Get current environment domain
     *
     * @returns
     */
    function getClientUrl() {
        return Xrm.Utility.getGlobalContext().getClientUrl()
    }
    /**
     * Show error dialog
     *
     * @param {*} message
     * @param {*} e
     */
    function showError(message, e) {
        endProcess()
        console.log(e)

        let details = "";
        if (e) {
            details = e.message + " InnerError: " + e.innerError.message + " stacktrace: " + e.innerError.stacktrace
        }
        let errorOptions = {
            message: "Error in cloning Project",
            details: message + details
        }

        Xrm.Navigation.openErrorDialog(errorOptions).then(
            function (success) {
                console.log(success)
            },
            function (error) {
                console.log(error)
            })
    }
 /**
     * Start process
     */
    function startProcess(message) {
        Xrm.Utility.showProgressIndicator(message)
    }

    /**
     * End process
     */
    function endProcess() {
        Xrm.Utility.closeProgressIndicator()
    }
}).call(NavcoSdk);