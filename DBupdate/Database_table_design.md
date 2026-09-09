Database table design


users
- id                PK
- email             UNIQUE NOT NULL
- password_hash     NOT NULL
- role              NOT NULL   -- consumer / staff / admin
- full_name         NULL
- phone             NULL
- created_at        NOT NULL


devices
- id                PK
- owner_id          FK -> users.id
- name              NOT NULL        -- like iPhone X
- device_type       NOT NULL        -- phone / laptop / tablet / battery / other
- brand             NULL
- model             NULL
- condition         NOT NULL        -- working / broken / unknown
- age_years         NULL
- demand            NULL            -- high / medium / low / unknown
- classification    NOT NULL        -- current / recycle / rare / unwanted / unknown
- workflow_status   NOT NULL        -- pending / processing / done / rejected
- notes             NULL
- created_at        NOT NULL


collection_requests
- id                  PK
- consumer_id         FK -> users.id
- device_id           FK -> devices.id
- preferred_method    NOT NULL      -- dropoff / pickup
- pickup_address      NULL
- contact_phone       NULL
- scheduled_time      NULL
- status              NOT NULL      -- submitted / approved / assigned / collected / completed / rejected
- assigned_staff_id   FK -> users.id   NULL
- staff_note          NULL
- created_at          NOT NULL
- updated_at          NOT NULL


request_status_logs
- id                PK
- request_id        FK -> collection_requests.id
- old_status        NULL
- new_status        NOT NULL
- changed_by        FK -> users.id
- note              NULL
- created_at        NOT NULL




Perhaps it will be added:

data_retrieval_requests
- id
- device_id
- consumer_id
- status
- quoted_price
- final_price
- assigned_staff_id
- note
- created_at