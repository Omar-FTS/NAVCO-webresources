function createNewBoxSale(executionContext, parentEntity, parentEntityId) {
   var BPF_BOX_SALE_QUOTE_TO_ORDER = "Box Sale Quote to Order";
        // ================================
    // Get BPF ID by Name (Returns Promise with processId)
    // ================================
    function getBpfIdByName(processName) {
        var fetchXml =
            `<fetch top="1">
            <entity name="workflow">
                <attribute name="workflowid" />
                <filter>
                    <condition attribute="name" operator="eq" value="${processName}" />
                    <condition attribute="type" operator="eq" value="1" />
                    <condition attribute="statecode" operator="eq" value="1" />
                </filter>
            </entity>
        </fetch>`;

        return Xrm.WebApi.retrieveMultipleRecords(
            "workflow",
            "?fetchXml=" + encodeURIComponent(fetchXml)
        ).then(
            function (result) {

                if (result.entities.length === 0) {
                    console.warn("BPF not found or not active:", processName);
                    return null;
                }
                return result.entities[0].workflowid;
            },
            function (error) {
                console.error("Error retrieving BPF:", error.message);
                return null;
            }
        );
    }

    getBpfIdByName(BPF_BOX_SALE_QUOTE_TO_ORDER).then(function(processId) {
        var formOptions = {
            entityName: "quote",
            formId: "05ec5b98-a477-eb11-a812-000d3a11f667",
            openInNewWindow: false,
            processId: processId
        };

        if (parentEntity == "account") {
            Xrm.WebApi.retrieveRecord("account", parentEntityId, "?$select=name").then(
                function success(result) {
                    var name = result.name;
                    var formParameters = {
                        dc_quotemodel: 948170001,
                        customerid: parentEntityId,
                        customeridname: name,
                        customeridtype: "account"

                    }
                    Xrm.Navigation.openForm(formOptions, formParameters);
                },
                function (error) {
                    console.log(error.message);
                }
            )
        } else {
            var formParameters = {
                dc_quotemodel: 948170001
            }
            Xrm.Navigation.openForm(formOptions, formParameters);
        }
    });
}