

function OrderCheckForDiscontinuedProducts(executionContext) {
    var formContext = executionContext.getFormContext();
    var statecode = formContext.getAttribute('statecode').getValue();
    var quoteid = formContext.getAttribute('quoteid').getValue();
    var orderId = formContext.data.entity.getId().replace("{", "").replace("}", "");

    debugger;
    if (statecode != 0 || quoteid == null)
        return;
    Xrm.WebApi.retrieveRecord("salesorder", orderId, "?$select=dc_hasdiscontinuedproducts").then(
        function success(result) {
        // perform operations on record retrieval
        var hasDiscontinuedProducts = result.dc_hasdiscontinuedproducts;
        if (hasDiscontinuedProducts == true) {

            formContext.ui.setFormNotification('ERROR: The quote for this sales order contains discontinued products!', 'ERROR', 'discprods');
        } else {
            formContext.ui.clearFormNotification("discprods");
        }

    },
        function (error) {
        console.log(error.message);
        // handle error conditions
    });

}
