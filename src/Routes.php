<?php

declare(strict_types=1);

namespace EventFlow;

use EventFlow\Handlers\AuthHandler;
use EventFlow\Handlers\ConnectionHandler;
use EventFlow\Handlers\DeviceHandler;
use EventFlow\Handlers\ExportHandler;
use EventFlow\Handlers\ProjectHandler;
use EventFlow\Handlers\RackHandler;
use EventFlow\Handlers\RackLinkHandler;
use EventFlow\Handlers\SlotHandler;

final class Routes
{
    public static function register(Router $r): void
    {
        $r->post('#^/api/ef/auth/register$#', static fn () => AuthHandler::register());
        $r->post('#^/api/ef/auth/login$#', static fn () => AuthHandler::login());
        $r->post('#^/api/ef/auth/logout$#', static fn () => AuthHandler::logout());
        $r->get('#^/api/ef/auth/me$#', static fn () => AuthHandler::me());

        $r->get('#^/api/ef/projects$#', static fn () => ProjectHandler::list());
        $r->post('#^/api/ef/projects$#', static fn () => ProjectHandler::create());
        $r->get('#^/api/ef/projects/(\d+)$#', static fn (string $id) => ProjectHandler::get($id));
        $r->put('#^/api/ef/projects/(\d+)$#', static fn (string $id) => ProjectHandler::update($id));
        $r->delete('#^/api/ef/projects/(\d+)$#', static fn (string $id) => ProjectHandler::delete($id));
        $r->post('#^/api/ef/projects/(\d+)/duplicate$#', static fn (string $id) => ProjectHandler::duplicate($id));

        $r->get('#^/api/ef/devices$#', static fn () => DeviceHandler::list());
        $r->post('#^/api/ef/devices$#', static fn () => DeviceHandler::create());
        $r->get('#^/api/ef/devices/(\d+)$#', static fn (string $id) => DeviceHandler::get($id));
        $r->put('#^/api/ef/devices/(\d+)$#', static fn (string $id) => DeviceHandler::update($id));
        $r->delete('#^/api/ef/devices/(\d+)$#', static fn (string $id) => DeviceHandler::delete($id));

        $r->get('#^/api/ef/racks$#', static fn () => RackHandler::list());
        $r->post('#^/api/ef/racks$#', static fn () => RackHandler::create());
        $r->put('#^/api/ef/racks/(\d+)$#', static fn (string $id) => RackHandler::update($id));
        $r->delete('#^/api/ef/racks/(\d+)$#', static fn (string $id) => RackHandler::delete($id));

        $r->get('#^/api/ef/slots$#', static fn () => SlotHandler::list());
        $r->post('#^/api/ef/slots$#', static fn () => SlotHandler::create());
        $r->put('#^/api/ef/slots/(\d+)$#', static fn (string $id) => SlotHandler::update($id));
        $r->delete('#^/api/ef/slots/(\d+)$#', static fn (string $id) => SlotHandler::delete($id));

        $r->get('#^/api/ef/connections$#', static fn () => ConnectionHandler::list());
        $r->post('#^/api/ef/connections$#', static fn () => ConnectionHandler::create());
        $r->put('#^/api/ef/connections/(\d+)$#', static fn (string $id) => ConnectionHandler::update($id));
        $r->delete('#^/api/ef/connections/(\d+)$#', static fn (string $id) => ConnectionHandler::delete($id));

        $r->get('#^/api/ef/export/pdf$#', static fn () => ExportHandler::pdfData());

        $r->get('#^/api/ef/rack-links$#', static fn () => RackLinkHandler::list());
        $r->post('#^/api/ef/rack-links$#', static fn () => RackLinkHandler::create());
        $r->put('#^/api/ef/rack-links/(\d+)$#', static fn (string $id) => RackLinkHandler::update($id));
        $r->delete('#^/api/ef/rack-links/(\d+)$#', static fn (string $id) => RackLinkHandler::delete($id));
    }
}
