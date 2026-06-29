import type { AppProviderCategory } from '../../types/app-structure';

export const MAX_SCAN_ELEMENTS = 3000;
export const MAX_INSTANCE_PROPS = 200;
export const SKIP_PROP_PREFIXES = ['_', 'ɵ', 'ng', '__'];

// ─── Library source detection ─────────────────────────────────────────────────
export const LIBRARY_NAME_PATTERNS: Array<[RegExp, string]> = [
  // Angular built-ins
  [/^(CommonModule|NgIf|NgFor|NgForOf|NgClass|NgStyle|NgSwitch|NgSwitchCase|NgSwitchDefault|AsyncPipe|DatePipe|JsonPipe|SlicePipe|LowerCasePipe|UpperCasePipe|TitleCasePipe|CurrencyPipe|DecimalPipe|PercentPipe|KeyValuePipe|I18nPluralPipe|I18nSelectPipe)$/, '@angular/common'],
  [/^(BrowserModule|BrowserAnimationsModule|NoopAnimationsModule|BrowserTransferStateModule)$/, '@angular/platform-browser'],
  [/^(RouterModule|RouterLink|RouterOutlet|RouterLinkActive|ActivatedRoute|Router|RouterLinkWithHref)$/, '@angular/router'],
  [/^(HttpClientModule|HttpClient|HttpClientXsrfModule|HttpClientJsonpModule|HTTP_INTERCEPTORS)$/, '@angular/common/http'],
  [/^(FormsModule|ReactiveFormsModule|FormBuilder|FormGroup|FormControl|FormArray|NgModel|NgForm)$/, '@angular/forms'],
  [/^ServiceWorkerModule$/, '@angular/service-worker'],
  // Angular Material / CDK
  [/^Mat[A-Z]|^MatCommonModule$/, '@angular/material'],
  [/^Cdk[A-Z]|^OverlayModule$|^A11yModule$|^ScrollingModule$|^DragDropModule$|^PortalModule$/, '@angular/cdk'],
  // NgRx
  [/^(StoreModule|EffectsModule|StoreDevtools|StoreFeatureModule|ActionReducerMap)/, '@ngrx/store'],
  [/^ComponentStore$/, '@ngrx/component-store'],
  [/^SignalStore$/, '@ngrx/signals'],
  // i18n
  [/^(TranslateModule|TranslatePipe|TranslateDirective|TranslateService)$/, '@ngx-translate/core'],
  // Scrollbar
  [/^NgScrollbar(Module)?$/, 'ngx-scrollbar'],
  // Bootstrap-based
  [/^NgbModule$|^Ngb[A-Z]/, '@ng-bootstrap/ng-bootstrap'],
  // Ionic
  [/^IonicModule$|^Ion[A-Z]/, '@ionic/angular'],
  // NG-ZORRO
  [/^Nz[A-Z]/, 'ng-zorro-antd'],
  // Nebular
  [/^Nb[A-Z]/, '@nebular/theme'],
  // Taiga UI
  [/^Tui[A-Z]/, '@taiga-ui/core'],
  // Clarity
  [/^Clr[A-Z]|^ClarityModule$/, '@clr/angular'],
  // ngneat
  [/^UntilDestroy$|^HotToast|^Dialog[A-Z]/, '@ngneat/until-destroy'],
  // Firebase
  [/^AngularFire|^AngularFirestore|^AngularFireAuth|^AngularFireDatabase/, '@angular/fire'],
  // AG Grid
  [/^AgGridModule$|^AgGridAngular$|^AgGrid[A-Z]/, 'ag-grid-angular'],
  // CoreUI Angular
  [/^(SidebarToggleDirective|SidebarTogglerDirective|ShadowOnScrollDirective|SidebarBrandComponent|SidebarBrandModule|SidebarModule|SidebarHeaderModule|SidebarFooterModule|SidebarNavModule|HeaderModule|FooterModule|NavbarModule|ContainerComponent|ContainerModule|GridModule|ButtonModule|BadgeModule|CardModule|ModalModule|AlertModule|CollapseModule|DropdownModule|ToastModule|SpinnerModule|ProgressModule|BreadcrumbModule|AvatarModule|NavModule|TabsModule|TooltipModule|PaginationModule|FormModule|CarouselModule|AccordionModule|TableModule|ListGroupModule|ImgModule|PlaceholderModule|PopoverModule|WidgetModule|CalloutModule|CloseButtonModule|ButtonGroupModule)$/, '@coreui/angular'],
  // CoreUI Icons
  [/^(IconModule|IconDirective|IconSetService|IconComponent)$/, '@coreui/icons-angular'],
  // PrimeNG
  [/^(DataTable|TieredMenu|MenuItem|Dropdown|MultiSelect|AutoComplete|Calendar|FileUpload|ColorPicker|TreeTable|TreeNode|Tree|DataView|OrderList|PickList|Galleria|DeferredLoader|Growl|LightBox|OverlayPanel|Panel|TabView|TabPanel|Accordion|Toolbar|Breadcrumb|Paginator|DataScroller|Carousel|Fieldset|Grid|BlockUI|CaptureGroup|ProgressBar|ProgressSpinner|ScrollPanel|Skeleton|VirtualScroller|Timeline|Avatar|AvatarGroup|Tag|Badge|Chip|Divider|Splitter|SplitterPanel|Card|Inplace|ScrollTop|Ripple|StyleClass|FocusTrap|Animate|AutoFocus|DeferModule|ImageModule|TableModule|DynamicDialogModule|Tooltip|Toast|ConfirmDialog|ConfirmPopup|ContextMenu|Dialog|Sidebar|Menu|MenuModule|MenubarModule|MegaMenu|TieredMenuModule|PanelMenuModule|SlideMenuModule|ButtonModule|SplitButtonModule|RadioButton|Checkbox|InputSwitch|InputText|InputNumber|InputMask|InputTextarea|Password|Knob|ListBox|SelectButton|ToggleButton|Rating|Slider|Chips|ColorPicker|TreeSelect|CascadeSelect|DropdownModule|MultiSelectModule|SpeedDial|DockModule|MeterGroup)Module$/, 'primeng'],
];

// ─── Provider categories ──────────────────────────────────────────────────────
export const PROVIDER_CATEGORY_PATTERNS: Array<[RegExp, AppProviderCategory]> = [
  [/^(Router|ActivatedRoute|RouterPreloader|RouteReuseStrategy|TitleStrategy|DefaultTitleStrategy|UrlSerializer|PreloadingStrategy|RouterConfigLoader|NavigationTransitions|RouterScroller|RouterLink|RouterOutlet|RouterLinkActive|RouterLinkWithHref|ChildrenOutletContexts|OutletContext)$/, 'router'],
  [/^(HttpClient|HttpHandler|HttpBackend|HttpXhrBackend|XhrFactory|HttpStateTransitionManager|HttpTransferCacheOptions|HttpTransferStateInterceptor|HTTP_INTERCEPTORS)$/, 'http'],
  [/^(FormBuilder|ReactiveFormBuilder|FormGroup|FormControl|FormArray|NgForm|NgModel|NgModelGroup|FormGroupDirective|FormControlDirective|FormArrayName|FormsModule|ReactiveFormsModule)$/, 'forms'],
  [/^(AnimationBuilder|AnimationDriver|AnimationEngine|BrowserAnimationBuilder|InjectableAnimationEngine|TransitionAnimationEngine|AnimationRendererFactory)$/, 'animations'],
  [/^(DomSanitizer|CSP_NONCE|SafeValue)$/, 'security'],
  [/^(LOCALE_ID|NgLocaleLocalization|NgLocalization|MissingTranslationStrategy|NgPluralCase)$/, 'i18n'],
  [/^(ApplicationRef|ApplicationInitStatus|NgZone|ErrorHandler|Compiler|PlatformRef|TestabilityRegistry|Testability|Title|Meta|Location|PlatformLocation|BrowserPlatformLocation|PathLocationStrategy|HashLocationStrategy|APP_BASE_HREF|ViewportScroller|RendererFactory2|DomRendererFactory2|EventManager|SharedStylesHost|TransferState|IS_PLATFORM_BROWSER|APP_ID|APP_INITIALIZER|APP_BOOTSTRAP_LISTENER|PLATFORM_ID|PLATFORM_INITIALIZER|ENVIRONMENT_INITIALIZER)$/, 'core'],
];

/** Provider names that are Angular implementation details — not shown to the user. */
export const PROVIDER_SKIP_PREFIXES = ['ɵ', 'Ɵ', '__ng'];
