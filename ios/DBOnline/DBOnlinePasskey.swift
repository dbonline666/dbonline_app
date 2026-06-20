import AuthenticationServices
import React
import UIKit

@objc(DBOnlinePasskey)
final class DBOnlinePasskey: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
  private var resolve: RCTPromiseResolveBlock?
  private var reject: RCTPromiseRejectBlock?

  @objc(authenticate:resolver:rejecter:)
  func authenticate(
    _ options: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 15.0, *) else {
      reject("passkey_unavailable", "当前 iOS 版本不支持 Passkey。", nil)
      return
    }

    do {
      let rpId = try relyingPartyId(from: options)
      let challenge = try dataValue(options["challenge"], field: "challenge")
      let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
      let request = provider.createCredentialAssertionRequest(challenge: challenge)
      request.allowedCredentials = try allowedCredentials(from: options)
      applyUserVerification(options["userVerification"], to: request)
      run(request)
      self.resolve = resolve
      self.reject = reject
    } catch {
      reject("passkey_options_invalid", error.localizedDescription, error)
    }
  }

  @objc(register:resolver:rejecter:)
  func register(
    _ options: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 15.0, *) else {
      reject("passkey_unavailable", "当前 iOS 版本不支持 Passkey。", nil)
      return
    }

    do {
      let rpId = try relyingPartyId(from: options)
      let challenge = try dataValue(options["challenge"], field: "challenge")
      guard let user = options["user"] as? NSDictionary else {
        throw PasskeyError.invalidOptions("缺少 user 参数")
      }
      let userId = try dataValue(user["id"], field: "user.id")
      let name = firstNonEmpty(stringValue(user["name"]), stringValue(user["displayName"]))
      if name.isEmpty {
        throw PasskeyError.invalidOptions("缺少 user.name 参数")
      }

      let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: rpId)
      let request = provider.createCredentialRegistrationRequest(
        challenge: challenge,
        name: name,
        userID: userId
      )
      applyUserVerification(options["userVerification"], to: request)
      run(request)
      self.resolve = resolve
      self.reject = reject
    } catch {
      reject("passkey_options_invalid", error.localizedDescription, error)
    }
  }

  @available(iOS 15.0, *)
  func authorizationController(
    controller: ASAuthorizationController,
    didCompleteWithAuthorization authorization: ASAuthorization
  ) {
    if let assertion = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
      resolve?([
        "id": base64Url(assertion.credentialID),
        "rawId": base64Url(assertion.credentialID),
        "type": "public-key",
        "response": [
          "authenticatorData": base64Url(assertion.rawAuthenticatorData),
          "clientDataJSON": base64Url(assertion.rawClientDataJSON),
          "signature": base64Url(assertion.signature),
          "userHandle": base64Url(assertion.userID),
        ],
      ])
      clearPromise()
      return
    }

    if let registration = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
      resolve?([
        "id": base64Url(registration.credentialID),
        "rawId": base64Url(registration.credentialID),
        "type": "public-key",
        "response": [
          "attestationObject": base64Url(registration.rawAttestationObject ?? Data()),
          "clientDataJSON": base64Url(registration.rawClientDataJSON),
        ],
      ])
      clearPromise()
      return
    }

    reject?("passkey_unknown_credential", "iOS 返回了不支持的 Passkey 凭据类型。", nil)
    clearPromise()
  }

  func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
    reject?("passkey_failed", error.localizedDescription, error)
    clearPromise()
  }

  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow } ?? ASPresentationAnchor()
  }

  @available(iOS 15.0, *)
  private func run(_ request: ASAuthorizationRequest) {
    DispatchQueue.main.async {
      let controller = ASAuthorizationController(authorizationRequests: [request])
      controller.delegate = self
      controller.presentationContextProvider = self
      controller.performRequests()
    }
  }

  @available(iOS 15.0, *)
  private func allowedCredentials(
    from options: NSDictionary
  ) throws -> [ASAuthorizationPlatformPublicKeyCredentialDescriptor] {
    guard let list = options["allowCredentials"] as? [NSDictionary] else {
      return []
    }
    return try list.map { item in
      ASAuthorizationPlatformPublicKeyCredentialDescriptor(
        credentialID: try dataValue(item["id"], field: "allowCredentials.id")
      )
    }
  }

  private func relyingPartyId(from options: NSDictionary) throws -> String {
    if let rpId = stringValue(options["rpId"]), !rpId.isEmpty {
      return rpId
    }
    if let rp = options["rp"] as? NSDictionary, let rpId = stringValue(rp["id"]), !rpId.isEmpty {
      return rpId
    }
    throw PasskeyError.invalidOptions("缺少 rpId 参数")
  }

  @available(iOS 15.0, *)
  private func applyUserVerification(
    _ value: Any?,
    to request: ASAuthorizationPlatformPublicKeyCredentialAssertionRequest
  ) {
    request.userVerificationPreference = userVerificationPreference(value)
  }

  @available(iOS 15.0, *)
  private func applyUserVerification(
    _ value: Any?,
    to request: ASAuthorizationPlatformPublicKeyCredentialRegistrationRequest
  ) {
    request.userVerificationPreference = userVerificationPreference(value)
  }

  @available(iOS 15.0, *)
  private func userVerificationPreference(
    _ value: Any?
  ) -> ASAuthorizationPublicKeyCredentialUserVerificationPreference {
    switch stringValue(value) {
    case "required":
      return .required
    case "discouraged":
      return .discouraged
    default:
      return .preferred
    }
  }

  private func dataValue(_ value: Any?, field: String) throws -> Data {
    if let text = stringValue(value), !text.isEmpty {
      return try base64UrlData(text)
    }
    if let bytes = value as? [NSNumber] {
      return Data(bytes.map { UInt8(truncating: $0) })
    }
    throw PasskeyError.invalidOptions("缺少 \(field) 参数")
  }

  private func stringValue(_ value: Any?) -> String? {
    if let value = value as? String {
      return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return nil
  }

  private func base64UrlData(_ value: String) throws -> Data {
    var base64 = value.replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    let padding = 4 - base64.count % 4
    if padding < 4 {
      base64 += String(repeating: "=", count: padding)
    }
    guard let data = Data(base64Encoded: base64) else {
      throw PasskeyError.invalidOptions("Base64URL 参数格式无效")
    }
    return data
  }

  private func base64Url(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  private func clearPromise() {
    resolve = nil
    reject = nil
  }
}

private enum PasskeyError: LocalizedError {
  case invalidOptions(String)

  var errorDescription: String? {
    switch self {
    case .invalidOptions(let message):
      return message
    }
  }
}

private func firstNonEmpty(_ lhs: String?, _ rhs: String?) -> String {
  if let lhs, !lhs.isEmpty {
    return lhs
  }
  return rhs ?? ""
}
