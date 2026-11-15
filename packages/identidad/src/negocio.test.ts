import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  claveNegocioCanonica,
  codigosNegocio,
  perteneceAlNegocio,
  resolverOnboardingNegocio,
  proyectarPerfilPorNegocio,
} from "./negocio";

describe("aislamiento de usuarios y consentimientos por negocio (PLT-001 / PLT-003)", () => {
  it("normaliza cada negocio sin mezclar codigos entre Tinkay, Tranqi, FastFix y Margaritas", () => {
    assert.equal(claveNegocioCanonica("TNK"), "tinkay");
    assert.equal(claveNegocioCanonica("tinkay"), "tinkay");
    assert.equal(claveNegocioCanonica("TRANQ"), "tranqi");
    assert.equal(claveNegocioCanonica("FFH"), "fastfix");
    assert.equal(claveNegocioCanonica("MRG"), "margaritas");

    const codigosTinkay = codigosNegocio("tinkay");
    assert.ok(codigosTinkay.includes("tinkay"));
    assert.ok(codigosTinkay.includes("TNK"));
    assert.ok(!codigosTinkay.includes("tranqi"));
    assert.ok(!codigosTinkay.includes("TRANQ"));

    assert.equal(perteneceAlNegocio("TNK", "tinkay"), true);
    assert.equal(perteneceAlNegocio("TRANQ", "tinkay"), false);
  });

  it("exige onboarding independiente cuando un usuario registrado en Tranqi entra por primera vez a Tinkay", () => {
    const usuarioRegistradoSoloEnTranqi = {
      usu_onboarding_completo: true,
      usu_superadmin_plataforma: false,
      usu_whatsapp: "+593991112233",
      usu_autorizacion_whatsapp: true,
      usu_detalle_usuario: {
        registros_negocio: {
          tranqi: {
            nombres: "Ana",
            apellidos: "Jurídica",
            whatsapp: "+593991112233",
            autoriza_whatsapp: true,
            onboarding_completo: true,
          },
        },
      },
    };

    // En Tranqi sí tiene membresía y onboarding
    assert.equal(
      resolverOnboardingNegocio(usuarioRegistradoSoloEnTranqi, true, "tranqi"),
      true
    );

    // En Tinkay NO tiene membresía ni onboarding propio
    assert.equal(
      resolverOnboardingNegocio(usuarioRegistradoSoloEnTranqi, false, "tinkay"),
      false
    );
    assert.equal(
      resolverOnboardingNegocio(usuarioRegistradoSoloEnTranqi, true, "tinkay"),
      false
    );

    // Tampoco hereda en Tinkay el WhatsApp ni el consentimiento LOPDP otorgado a Tranqi
    const proyectadoTinkay = proyectarPerfilPorNegocio(
      usuarioRegistradoSoloEnTranqi,
      "tinkay",
      true
    );
    assert.equal(proyectadoTinkay?.usu_whatsapp, null);
    assert.equal(proyectadoTinkay?.usu_autorizacion_whatsapp, false);
    assert.equal(proyectadoTinkay?.usu_onboarding_completo, false);
  });

  it("mantiene intactas cuentas legadas dentro de su propio negocio pero bloquea cruce hacia otros negocios", () => {
    const usuarioLegadoTranqi = {
      usu_nombres: "Carlos",
      usu_apellidos: "Legado",
      usu_onboarding_completo: true,
      usu_superadmin_plataforma: false,
      usu_detalle_usuario: {},
    };

    // En su propio negocio legado (tieneMembresiaActiva = true) conserva onboarding
    assert.equal(resolverOnboardingNegocio(usuarioLegadoTranqi, true, "tranqi"), true);
    // En otro negocio donde NO tiene membresía (tieneMembresiaActiva = false) no pasa
    assert.equal(resolverOnboardingNegocio(usuarioLegadoTranqi, false, "tinkay"), false);
  });

  it("permite datos y WhatsApp independientes para el mismo correo en dos negocios distintos", () => {
    const usuarioMultiNegocio = {
      usu_nombres: "NombreBase",
      usu_apellidos: "ApellidoBase",
      usu_whatsapp: "+593980000001",
      usu_autorizacion_whatsapp: true,
      usu_onboarding_completo: true,
      usu_superadmin_plataforma: false,
      usu_detalle_usuario: {
        registros_negocio: {
          tranqi: {
            nombres: "Roberto",
            apellidos: "Legal",
            whatsapp: "+593980000001",
            autoriza_whatsapp: true,
            onboarding_completo: true,
          },
          tinkay: {
            nombres: "Roberto Eventos",
            apellidos: "Floristería",
            whatsapp: "+593997778888",
            autoriza_whatsapp: true,
            onboarding_completo: true,
          },
        },
      },
    };

    const vistaTranqi = proyectarPerfilPorNegocio(usuarioMultiNegocio, "tranqi", true);
    const vistaTinkay = proyectarPerfilPorNegocio(usuarioMultiNegocio, "tinkay", true);

    assert.equal(vistaTranqi?.usu_nombres, "Roberto");
    assert.equal(vistaTranqi?.usu_whatsapp, "+593980000001");

    assert.equal(vistaTinkay?.usu_nombres, "Roberto Eventos");
    assert.equal(vistaTinkay?.usu_whatsapp, "+593997778888");
  });
});
