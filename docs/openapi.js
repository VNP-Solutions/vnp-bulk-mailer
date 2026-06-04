/**
 * OpenAPI 3.0 spec for the VNP Email Utility API.
 * Keep this in sync with the routes/controllers as new endpoints are added.
 */
module.exports = {
    openapi: '3.0.3',
    info: {
        title: 'VNP Email Utility API',
        version: '0.1.0',
        description: 'Authentication and user endpoints for the bulk email utility.',
    },
    servers: [{ url: '/api', description: 'Current host' }],
    tags: [
        { name: 'Users', description: 'User management endpoints' },
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Contacts', description: 'Contact management (CRUD, filter, bulk upload, export)' },
        { name: 'Templates', description: 'Email template management (upload, list, view, delete)' },
        { name: 'Send', description: 'Bulk email send jobs and sending history' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        schemas: {
            User: {
                type: 'object',
                properties: {
                    _id: { type: 'string', example: '66501a3f5d2c8e0012abcd34' },
                    email: { type: 'string', format: 'email', example: 'jane@example.com' },
                    first_name: { type: 'string', example: 'Jane' },
                    last_name: { type: 'string', example: 'Doe' },
                    status: { type: 'string', enum: ['active', 'pending', 'revoked'], example: 'active' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                },
            },
            CreateUserRequest: {
                type: 'object',
                required: ['email', 'first_name', 'last_name', 'password'],
                properties: {
                    email: { type: 'string', format: 'email', example: 'jane@example.com' },
                    first_name: { type: 'string', example: 'Jane' },
                    last_name: { type: 'string', example: 'Doe' },
                    password: { type: 'string', format: 'password', minLength: 8, example: 'sup3rsecret' },
                },
            },
            Contact: {
                type: 'object',
                properties: {
                    _id: { type: 'string', example: '66501a3f5d2c8e0012abcd34' },
                    first_name: { type: 'string', example: 'Jane' },
                    last_name: { type: 'string', example: 'Doe' },
                    email: { type: 'string', format: 'email', example: 'jane@grandhotel.com' },
                    hotel_name: { type: 'string', example: 'Grand Hotel' },
                    portfolio: { type: 'string', example: 'Luxury Collection' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                },
            },
            CreateContactRequest: {
                type: 'object',
                required: ['email'],
                properties: {
                    first_name: { type: 'string', example: 'Jane' },
                    last_name: { type: 'string', example: 'Doe' },
                    email: { type: 'string', format: 'email', example: 'jane@grandhotel.com' },
                    hotel_name: { type: 'string', example: 'Grand Hotel' },
                    portfolio: { type: 'string', example: 'Luxury Collection' },
                },
            },
            ContactQueryRequest: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', example: 25 },
                    skip: { type: 'integer', example: 0 },
                    search: { type: 'string', example: 'jane' },
                    filters: {
                        type: 'object',
                        description: 'Per-field filters keyed by field name. Each value is { op: "in", value: [...] } or { op: "contains", value }.',
                        example: { portfolio: { op: 'in', value: ['Luxury Collection'] } },
                    },
                    sort: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                key: { type: 'string', example: 'last_name' },
                                dir: { type: 'string', enum: ['asc', 'desc'], example: 'asc' },
                            },
                        },
                    },
                },
            },
            Template: {
                type: 'object',
                properties: {
                    _id: { type: 'string', example: '66501a3f5d2c8e0012abcd34' },
                    name: { type: 'string', example: 'OTA POST Audit Enhancement' },
                    fields: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['first_name', 'Portfolio'],
                        description: 'Distinct [[field]] tokens found in the html.',
                    },
                    source_name: { type: 'string', example: 'ota-otapost-change.html' },
                    html: { type: 'string', description: 'Full HTML (returned by GET /templates/{id}, omitted from list).' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                },
            },
            SendJob: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    template_id: { type: 'string' },
                    template_name: { type: 'string', example: 'Welcome Email' },
                    subject: { type: 'string' },
                    mode: { type: 'string', enum: ['selected', 'all'] },
                    status: { type: 'string', enum: ['queued', 'running', 'completed', 'partial', 'failed', 'canceled'] },
                    total: { type: 'integer', example: 120 },
                    sent: { type: 'integer', example: 84 },
                    failed: { type: 'integer', example: 1 },
                    error: { type: 'string' },
                    started_at: { type: 'string', format: 'date-time' },
                    completed_at: { type: 'string', format: 'date-time' },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            EmailLog: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    job_id: { type: 'string' },
                    template_name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    contact_name: { type: 'string' },
                    subject: { type: 'string' },
                    status: { type: 'string', enum: ['sent', 'failed'] },
                    error: { type: 'string' },
                    sent_at: { type: 'string', format: 'date-time' },
                },
            },
            Error: {
                type: 'object',
                properties: { error: { type: 'string', example: 'Something went wrong' } },
            },
        },
    },
    paths: {
        '/users': {
            post: {
                tags: ['Users'],
                summary: 'Create a user (active, with a password)',
                description: 'Creates an active user immediately. Requires auth.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateUserRequest' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'User created',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/User' } },
                        },
                    },
                    400: {
                        description: 'Validation error',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                    409: {
                        description: 'Email already exists',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                },
            },
            get: {
                tags: ['Users'],
                summary: 'List users (search, filter by status, paginate)',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search name or email' },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'pending', 'revoked'] } },
                    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', example: 50 } },
                    { name: 'skip', in: 'query', schema: { type: 'integer', example: 0 } },
                ],
                responses: {
                    200: {
                        description: 'A page of users',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        items: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                                        total: { type: 'integer' },
                                        limit: { type: 'integer' },
                                        skip: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/users/invite': {
            post: {
                tags: ['Users'],
                summary: 'Invite a user by email',
                description: 'Creates a pending user and emails them an invite link to set their own password.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'first_name', 'last_name'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'newbie@example.com' },
                                    first_name: { type: 'string', example: 'New' },
                                    last_name: { type: 'string', example: 'Bie' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Invite sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
                    409: { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/users/invite/preview': {
            get: {
                tags: ['Users'],
                summary: 'Preview an invite by token (public — used by the accept page)',
                parameters: [{ name: 'token', in: 'query', required: true, schema: { type: 'string' } }],
                responses: {
                    200: {
                        description: 'Invite is valid',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        email: { type: 'string', format: 'email' },
                                        first_name: { type: 'string' },
                                        last_name: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    404: { description: 'Invalid invite', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    410: { description: 'Invite expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/users/accept-invite': {
            post: {
                tags: ['Users'],
                summary: 'Accept an invite and set a password (public)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['token', 'password'],
                                properties: {
                                    token: { type: 'string' },
                                    password: { type: 'string', format: 'password', minLength: 8, example: 'sup3rsecret' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Account activated', content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } } } } },
                    400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Invalid invite', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    410: { description: 'Invite expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/users/{id}': {
            get: {
                tags: ['Users'],
                summary: 'Get a user (only yourself)',
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'The user', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
                    403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Users'],
                summary: 'Revoke a user\'s access (soft — can be re-invited)',
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'Access revoked', content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
                    400: { description: "Can't revoke yourself", content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/users/{id}/permanent': {
            delete: {
                tags: ['Users'],
                summary: 'Permanently delete a user (only once revoked)',
                description: 'Hard-deletes the user record. The user must already be revoked, and you cannot delete yourself.',
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'User deleted', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    400: { description: 'Not revoked / cannot delete yourself', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'User not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Log in (step 1) — sends an OTP to the user email',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'jane@example.com' },
                                    password: { type: 'string', format: 'password', example: 'sup3rsecret' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'OTP sent',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string', example: 'OTP sent to your email' },
                                        email: { type: 'string', example: 'jane@example.com' },
                                        expires_at: { type: 'string', format: 'date-time' },
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Invalid credentials',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                },
            },
        },
        '/auth/verify': {
            post: {
                tags: ['Auth'],
                summary: 'Log in (step 2) — verify OTP, returns a JWT',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'otp'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'jane@example.com' },
                                    otp: { type: 'string', example: '123456' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Authenticated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        userId: { type: 'string' },
                                        token: { type: 'string' },
                                        first_name: { type: 'string' },
                                        last_name: { type: 'string' },
                                        email: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Invalid or expired code',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                },
            },
        },
        '/auth/forgot-password': {
            post: {
                tags: ['Auth'],
                summary: 'Request a password reset code',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'jane@example.com' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Reset code sent if the account exists',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                },
            },
        },
        '/auth/forgot-password/verify': {
            post: {
                tags: ['Auth'],
                summary: 'Verify reset code, returns a reset token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'otp'],
                                properties: {
                                    email: { type: 'string', format: 'email', example: 'jane@example.com' },
                                    otp: { type: 'string', example: '123456' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Reset token issued',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { reset_token: { type: 'string' } },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Invalid or expired code',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                },
            },
        },
        '/auth/forgot-password/reset': {
            post: {
                tags: ['Auth'],
                summary: 'Reset the password using a reset token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['reset_token', 'new_password'],
                                properties: {
                                    reset_token: { type: 'string' },
                                    new_password: { type: 'string', format: 'password', minLength: 8, example: 'newsecret1' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Password reset',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                    401: {
                        description: 'Invalid or expired reset token',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
                        },
                    },
                },
            },
        },
        '/contacts': {
            post: {
                tags: ['Contacts'],
                summary: 'Create a contact',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CreateContactRequest' },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Contact created',
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/Contact' } },
                        },
                    },
                    400: {
                        description: 'Validation error',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
            },
        },
        '/contacts/query': {
            post: {
                tags: ['Contacts'],
                summary: 'Query contacts (filter, sort, search, paginate)',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ContactQueryRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'A page of contacts',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        items: { type: 'array', items: { $ref: '#/components/schemas/Contact' } },
                                        total: { type: 'integer', example: 42 },
                                        limit: { type: 'integer' },
                                        skip: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/contacts/template': {
            get: {
                tags: ['Contacts'],
                summary: 'Download a blank .xlsx import template',
                description: 'Returns a starter workbook with the expected columns and one example row.',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'An .xlsx template file',
                        content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } },
                    },
                },
            },
        },
        '/contacts/distinct/{field}': {
            get: {
                tags: ['Contacts'],
                summary: 'Distinct values for a filterable field',
                description: 'Powers the per-column multi-select filter. Field must be one of: first_name, last_name, email, hotel_name, portfolio.',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'field', in: 'path', required: true, schema: { type: 'string', example: 'portfolio' } },
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', example: 200 } },
                ],
                responses: {
                    200: {
                        description: 'Distinct values',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        values: { type: 'array', items: { type: 'string' } },
                                        total: { type: 'integer' },
                                        shown: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Field is not filterable',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
            },
        },
        '/contacts/export': {
            post: {
                tags: ['Contacts'],
                summary: 'Export contacts to .xlsx (all matching filters, or selected ids)',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    ids: { type: 'array', items: { type: 'string' }, description: 'Export only these contact ids. Takes precedence over filters.' },
                                    filters: { type: 'object' },
                                    sort: { type: 'array', items: { type: 'object' } },
                                    search: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'An .xlsx file',
                        content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } },
                    },
                },
            },
        },
        '/contacts/bulk': {
            post: {
                tags: ['Contacts'],
                summary: 'Bulk upload contacts from a spreadsheet',
                description: 'Accepts a .csv/.xls/.xlsx file (multipart field "file") with First Name, Last Name, Email, Hotel Name, Portfolio columns.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: { file: { type: 'string', format: 'binary' } },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Import summary',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        rows_total: { type: 'integer' },
                                        rows_inserted: { type: 'integer' },
                                        rows_failed: { type: 'integer' },
                                        errors: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: { row: { type: 'integer' }, message: { type: 'string' } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/contacts/{id}': {
            delete: {
                tags: ['Contacts'],
                summary: 'Delete a contact',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                ],
                responses: {
                    200: {
                        description: 'Deleted',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                    404: {
                        description: 'Contact not found',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
            },
        },
        '/templates': {
            post: {
                tags: ['Templates'],
                summary: 'Create a template from raw HTML (JSON body)',
                description: 'Paste raw HTML instead of uploading a file. [[field]] tokens are detected automatically.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'html'],
                                properties: {
                                    name: { type: 'string', example: 'Welcome Email' },
                                    html: { type: 'string', example: '<p>Hi [[first_name]]…</p>' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Template created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Template' } } } },
                    400: { description: 'Missing name/html', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/templates/query': {
            post: {
                tags: ['Templates'],
                summary: 'List templates (search, sort, paginate)',
                description: 'Returns templates without their html blob.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    limit: { type: 'integer', example: 25 },
                                    skip: { type: 'integer', example: 0 },
                                    search: { type: 'string', example: 'audit' },
                                    sort: { type: 'array', items: { type: 'object' } },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'A page of templates',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        items: { type: 'array', items: { $ref: '#/components/schemas/Template' } },
                                        total: { type: 'integer' },
                                        limit: { type: 'integer' },
                                        skip: { type: 'integer' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        '/templates/upload': {
            post: {
                tags: ['Templates'],
                summary: 'Upload an HTML email template',
                description: 'Multipart upload (field "file"). Optional "name" field; defaults to the filename. [[field]] tokens are extracted automatically.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: { type: 'string', format: 'binary' },
                                    name: { type: 'string', example: 'OTA POST Audit Enhancement' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Template created',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Template' } } },
                    },
                    400: {
                        description: 'No file / empty html',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
            },
        },
        '/templates/{id}': {
            get: {
                tags: ['Templates'],
                summary: 'Get a template (including its html)',
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: {
                        description: 'The template',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Template' } } },
                    },
                    404: {
                        description: 'Template not found',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
            },
            put: {
                tags: ['Templates'],
                summary: 'Update a template (name and/or html)',
                description: 'Editing the html re-detects its [[field]] tokens.',
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string', example: 'Welcome Email' },
                                    html: { type: 'string', example: '<p>Hi [[first_name]]…</p>' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Updated template', content: { 'application/json': { schema: { $ref: '#/components/schemas/Template' } } } },
                    400: { description: 'Empty name/html', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    404: { description: 'Template not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
            delete: {
                tags: ['Templates'],
                summary: 'Delete a template',
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: {
                        description: 'Deleted',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                    404: {
                        description: 'Template not found',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
            },
        },
        '/send/jobs': {
            post: {
                tags: ['Send'],
                summary: 'Create a bulk send job (starts sending in the background)',
                description: 'Renders the template per contact (replacing [[field]] tokens) and sends via Gmail SMTP, rate-limited. mode "selected" uses contact_ids; mode "all" uses filters/search to target every matching contact.',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['template_id', 'subject'],
                                properties: {
                                    template_id: { type: 'string' },
                                    subject: { type: 'string', example: 'An update for [[hotel_name]]' },
                                    mode: { type: 'string', enum: ['selected', 'all'], example: 'selected' },
                                    contact_ids: { type: 'array', items: { type: 'string' } },
                                    filters: { type: 'object' },
                                    search: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Job created and queued', content: { 'application/json': { schema: { $ref: '#/components/schemas/SendJob' } } } },
                    400: { description: 'No recipients / missing subject', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/send/jobs/query': {
            post: {
                tags: ['Send'],
                summary: 'List send jobs',
                security: [{ bearerAuth: [] }],
                requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { limit: { type: 'integer' }, skip: { type: 'integer' } } } } } },
                responses: {
                    200: {
                        description: 'A page of jobs',
                        content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/SendJob' } }, total: { type: 'integer' } } } } },
                    },
                },
            },
        },
        '/send/jobs/{id}': {
            get: {
                tags: ['Send'],
                summary: 'Get a job (poll for delivered/failed progress)',
                security: [{ bearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    200: { description: 'The job', content: { 'application/json': { schema: { $ref: '#/components/schemas/SendJob' } } } },
                    404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/send/history/query': {
            post: {
                tags: ['Send'],
                summary: 'Query sending history (one row per email)',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    limit: { type: 'integer' },
                                    skip: { type: 'integer' },
                                    search: { type: 'string' },
                                    filters: { type: 'object', example: { status: { op: 'in', value: ['sent'] }, template_name: { op: 'eq', value: 'Welcome Email' } } },
                                    sort: { type: 'array', items: { type: 'object' } },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'A page of email log rows',
                        content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/EmailLog' } }, total: { type: 'integer' } } } } },
                    },
                },
            },
        },
        '/send/history/templates': {
            get: {
                tags: ['Send'],
                summary: 'Distinct template names that appear in history (for the filter)',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: 'Template names', content: { 'application/json': { schema: { type: 'object', properties: { templates: { type: 'array', items: { type: 'string' } } } } } } },
                },
            },
        },
    },
};
