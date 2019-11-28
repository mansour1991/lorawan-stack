// Copyright © 2019 The Things Network Foundation, The Things Industries B.V.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as Yup from 'yup'

import randomByteString from '../../../lib/random-bytes'
import sharedMessages from '../../../../lib/shared-messages'
import { address as addressRegexp } from '../../../lib/regexp'
import m from '../../../components/device-data-form/messages'

import { selectJsConfig } from '../../../../lib/selectors/env'

import { parseLorawanMacVersion } from '../utils'

const jsConfig = selectJsConfig()

const random16BytesString = () => randomByteString(32)

const validationSchema = Yup.object().shape({
  join_server_address: Yup.string().when('$externalJs', {
    is: false,
    then: schema =>
      schema
        .matches(addressRegexp, sharedMessages.validateAddressFormat)
        .default(new URL(jsConfig.base_url).hostname),
    otherwise: schema => schema.strip(),
  }),
  net_id: Yup.string().when('$externalJs', {
    is: true,
    then: Yup.string().strip(),
    otherwise: Yup.nullableString()
      .emptyOrLength(3 * 2, m.validate6)
      .default(''), // 3 Byte hex
  }),
  root_keys: Yup.object().when(
    ['$externalJs', '$lorawanVersion'],
    (externalJs, version, schema) => {
      const strippedSchema = Yup.object().strip()
      const keySchema = Yup.lazy(() => {
        return !externalJs
          ? Yup.object().shape({
              key: Yup.string()
                .length(16 * 2, m.validate32) // 16 Byte hex
                .default(random16BytesString),
            })
          : Yup.object().strip()
      })

      if (externalJs) {
        return schema.shape({
          nwk_key: strippedSchema,
          app_key: strippedSchema,
        })
      }

      if (parseLorawanMacVersion(version) < 110) {
        return schema.shape({
          nwk_key: strippedSchema,
          app_key: keySchema,
        })
      }

      return schema.shape({
        nwk_key: keySchema,
        app_key: keySchema,
      })
    },
  ),
  resets_join_nonces: Yup.boolean().when('$lorawanVersion', {
    // Verify if lorawan version is 1.1.0 or higher.
    is: version => parseLorawanMacVersion(version) >= 110,
    then: schema => schema.default(false),
    otherwise: schema => schema.strip(),
  }),
  _external_js: Yup.boolean().when('$externalJs', {
    is: true,
    then: Yup.boolean()
      .default(true)
      .transform(() => true),
    otherwise: Yup.boolean()
      .default(false)
      .transform(() => false),
  }),
})

export default validationSchema
