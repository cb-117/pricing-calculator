const { app } = require('@azure/functions');
const { TableClient, AzureNamedKeyCredential } = require('@azure/data-tables');

app.http('pricing', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const account = process.env.STORAGE_ACCOUNT_NAME;
    const key     = process.env.STORAGE_ACCOUNT_KEY;

    if (!account || !key) {
      return { status: 500, jsonBody: { error: 'Storage credentials not configured.' } };
    }

    const credential = new AzureNamedKeyCredential(account, key);
    const client = new TableClient(
      `https://${account}.table.core.windows.net`,
      'PricingConfig',
      credential
    );

    const result = {};
    for await (const entity of client.listEntities({
      queryOptions: { filter: "PartitionKey eq 'pricing'" }
    })) {
      result[entity.rowKey] = JSON.parse(entity.data);
    }

    return {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      jsonBody: result,
    };
  },
});
