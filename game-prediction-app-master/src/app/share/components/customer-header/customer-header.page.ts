import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-customer-header',
  templateUrl: './customer-header.page.html',
  styleUrls: ['./customer-header.page.scss'],
})
export class CustomerHeaderPage implements OnInit {
  @Input() game!: string;

  constructor() {}

  ngOnInit() {}
}
